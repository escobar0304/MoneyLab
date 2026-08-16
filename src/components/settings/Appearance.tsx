import { useDensity, type Density } from '../../lib/density';
import { usePrivacy } from '../../lib/privacy';
import { Card, SectionTitle } from '../ui/primitives';

const OPTIONS: { id: Density; label: string; description: string }[] = [
  { id: 'comfortable', label: 'Comfortable', description: 'Roomier panels. Easier to read a page at a time.' },
  { id: 'compact', label: 'Compact', description: 'Tighter panels. More of the dashboard on screen at once.' },
];

/**
 * How much air the panels get.
 *
 * A real setting rather than a theme gimmick: this app is read two different
 * ways — a daily glance at the top of the page, and an evening spent going
 * through a statement — and those two want opposite amounts of space. Every
 * panel's padding comes from one custom property, so this is a variable swap
 * rather than a second stylesheet to keep in step.
 */
export function Appearance() {
  const [density, setDensity] = useDensity();
  const [hidden, setHidden] = usePrivacy();

  return (
    <Card>
      <SectionTitle>Appearance</SectionTitle>
      <fieldset>
        <legend className="t-label mb-2">Density</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {OPTIONS.map((option) => (
            <label
              key={option.id}
              className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 transition-colors duration-200 ${
                density === option.id ? 'border-accent/40 bg-accent/10' : 'border-hairline hover:border-border'
              }`}
            >
              <input
                type="radio"
                name="density"
                value={option.id}
                checked={density === option.id}
                onChange={() => setDensity(option.id)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
              />
              <span className="min-w-0">
                <span className={`block text-sm font-medium ${density === option.id ? 'text-accent' : 'text-ink'}`}>{option.label}</span>
                <span className="t-caption mt-0.5 block">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 border-t border-hairline pt-4">
        <p className="t-label mb-2">Privacy</p>
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={hidden}
            onChange={(e) => setHidden(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
          />
          <span className="min-w-0">
            <span className="block text-sm text-ink">Hide amounts</span>
            <span className="t-caption mt-0.5 block">
              Blurs every figure in the app so you can show someone the dashboard without showing them the money. Also on the eye button at
              the foot of the menu, which is where to reach for it in a hurry.
            </span>
          </span>
        </label>
      </div>
    </Card>
  );
}
