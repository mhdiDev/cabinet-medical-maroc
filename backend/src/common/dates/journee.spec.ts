// backend/src/common/dates/journee.spec.ts
import { FUSEAU_CABINET, journeeEnUtc } from './journee';

// Date et heure locales d'un instant dans le fuseau, ex. « 2026-11-10 00:00 »
function local(instant: Date, fuseau = FUSEAU_CABINET): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseau,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant);
  const v = (t: string) => p.find((x) => x.type === t)!.value;
  return `${v('year')}-${v('month')}-${v('day')} ${v('hour')}:${v('minute')}`;
}

describe('journeeEnUtc', () => {
  it('jour ordinaire (UTC+1) : la journée commence à 23:00 UTC la veille', () => {
    const { debut, fin } = journeeEnUtc('2026-11-10');
    expect(debut.toISOString()).toBe('2026-11-09T23:00:00.000Z');
    expect(fin.toISOString()).toBe('2026-11-10T23:00:00.000Z');
  });

  it('jour de Ramadan (UTC+0) : la journée commence à minuit UTC', () => {
    const { debut, fin } = journeeEnUtc('2026-03-01');
    expect(debut.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(fin.toISOString()).toBe('2026-03-02T00:00:00.000Z');
  });

  it("chaque jour de 2026, changements d'heure compris, va de minuit à minuit heure locale", () => {
    for (let jour = new Date(Date.UTC(2026, 0, 1)); jour.getUTCFullYear() === 2026; jour.setUTCDate(jour.getUTCDate() + 1)) {
      const date = jour.toISOString().slice(0, 10);
      const { debut, fin } = journeeEnUtc(date);
      expect(local(debut)).toBe(`${date} 00:00`);
      const lendemain = new Date(jour.getTime() + 86_400_000).toISOString().slice(0, 10);
      expect(local(fin)).toBe(`${lendemain} 00:00`);
    }
  });

  it('accepte un autre fuseau', () => {
    expect(journeeEnUtc('2026-07-01', 'Europe/Paris').debut.toISOString()).toBe('2026-06-30T22:00:00.000Z');
  });
});
