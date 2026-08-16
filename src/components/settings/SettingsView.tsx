import { ExportImport } from './ExportImport';
import { BackupFolder } from './BackupFolder';
import { Appearance } from './Appearance';

export function SettingsView() {
  return (
    <div className="view-stack">
      <ExportImport />
      <BackupFolder />
      <Appearance />
    </div>
  );
}
