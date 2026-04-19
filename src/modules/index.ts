import { FilesystemModule } from "./FilesystemModule";
import { ApplicationModule } from "./ApplicationModule";
import { SystemInfoModule } from "./SystemInfoModule";
import { BrowserModule } from "./BrowserModule";

// 시스템에 등록된 모든 모듈의 목록 (이전의 config/modules.ts 역할을 대체합니다)
export const MODULE_REGISTRY = [
  FilesystemModule,
  ApplicationModule,
  SystemInfoModule,
  BrowserModule
];