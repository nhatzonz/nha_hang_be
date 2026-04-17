import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BankAccount } from './bank-account.entity';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';

@Injectable()
export class BankAccountsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(BankAccount)
    private readonly bankRepo: Repository<BankAccount>,
  ) {}

  async findAll() {
    return this.bankRepo.find({
      order: { is_active: 'DESC', created_at: 'DESC' },
    });
  }

  async getActive() {
    return this.bankRepo.findOne({ where: { is_active: 1 } });
  }

  async findOne(id: number) {
    const acc = await this.bankRepo.findOne({ where: { id } });
    if (!acc) throw new NotFoundException('Không tìm thấy tài khoản ngân hàng');
    return acc;
  }

  async create(dto: CreateBankAccountDto, createdBy: number) {
    // Duplicate check: same bank + account number
    const dup = await this.bankRepo.findOne({
      where: {
        bank_bin: dto.bank_bin,
        account_number: dto.account_number,
      },
    });
    if (dup) throw new ConflictException('Tài khoản này đã tồn tại');

    const acc = this.bankRepo.create({
      ...dto,
      created_by: createdBy,
      is_active: 0,
    });
    return this.bankRepo.save(acc);
  }

  async update(id: number, dto: UpdateBankAccountDto) {
    const acc = await this.findOne(id);

    // If update account_number/bank_bin, check duplicate
    const newBin = dto.bank_bin ?? acc.bank_bin;
    const newNum = dto.account_number ?? acc.account_number;
    if (newBin !== acc.bank_bin || newNum !== acc.account_number) {
      const dup = await this.bankRepo.findOne({
        where: { bank_bin: newBin, account_number: newNum },
      });
      if (dup && dup.id !== id) {
        throw new ConflictException('Tài khoản này đã tồn tại');
      }
    }

    Object.assign(acc, dto);
    return this.bankRepo.save(acc);
  }

  /**
   * Kích hoạt 1 tài khoản — tự deactivate các tài khoản còn lại.
   * Chỉ 1 tài khoản active tại 1 thời điểm (business rule).
   */
  async activate(id: number) {
    await this.dataSource.transaction(async (manager) => {
      const acc = await manager.findOne(BankAccount, { where: { id } });
      if (!acc) throw new NotFoundException('Không tìm thấy tài khoản');

      // Deactivate all others
      await manager
        .createQueryBuilder()
        .update(BankAccount)
        .set({ is_active: 0 })
        .where('id != :id', { id })
        .execute();

      // Activate this
      acc.is_active = 1;
      await manager.save(acc);
    });

    return this.findOne(id);
  }

  async deactivate(id: number) {
    const acc = await this.findOne(id);
    acc.is_active = 0;
    return this.bankRepo.save(acc);
  }

  async remove(id: number) {
    const acc = await this.findOne(id);
    if (acc.is_active === 1) {
      throw new ConflictException(
        'Không thể xoá tài khoản đang được kích hoạt. Hãy kích hoạt tài khoản khác trước.',
      );
    }
    await this.bankRepo.remove(acc);
    return { message: 'Đã xoá tài khoản ngân hàng' };
  }
}
