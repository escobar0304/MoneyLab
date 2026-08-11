import { ExportImport } from './ExportImport';
import { BackupFolder } from './BackupFolder';

export function SettingsView() {
  return (
    <div className="space-y-6">
      <ExportImport />
      <BackupFolder />
    </div>
  );
}
