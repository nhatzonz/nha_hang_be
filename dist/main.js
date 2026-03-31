"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.enableCors();
    app.useGlobalPipes(new common_1.ValidationPipe({ whitelist: true, transform: true }));
    const port = process.env.APP_PORT || 3001;
    await app.listen(port);
    console.log(`Server running on http://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map