// Khởi động AI service (FastAPI) bằng đúng Python trong .venv của nha_hang_ai.
// Tự nhận diện Windows / Mac-Linux để chọn đường dẫn python phù hợp.
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const aiDir = path.resolve(__dirname, '..', '..', 'nha_hang_ai');
const isWin = process.platform === 'win32';

const venvPython = isWin
  ? path.join(aiDir, '.venv', 'Scripts', 'python.exe')
  : path.join(aiDir, '.venv', 'bin', 'python');

// Nếu chưa tạo venv thì báo rõ thay vì lỗi khó hiểu.
if (!fs.existsSync(venvPython)) {
  console.error('\n[AI] Khong tim thay venv:', venvPython);
  console.error('[AI] Hay tao venv truoc:');
  console.error('     cd nha_hang_ai');
  console.error(isWin ? '     python -m venv .venv' : '     python3 -m venv .venv');
  console.error(isWin ? '     .venv\\Scripts\\activate' : '     source .venv/bin/activate');
  console.error('     pip install -r requirements.txt\n');
  process.exit(1);
}

const args = [
  '-m', 'uvicorn', 'main:app',
  '--host', '127.0.0.1',
  '--port', '8000',
  '--reload',
];

const child = spawn(venvPython, args, { cwd: aiDir, stdio: 'inherit' });

child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
