import { BucketTree } from './BucketTree';
import { TemplateManager } from './TemplateManager';

export function BucketsView() {
  return (
    <div className="space-y-6">
      <BucketTree />
      <TemplateManager />
    </div>
  );
}
