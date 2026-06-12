import { getUnixTimestamp } from '../../src/utils/getUnixTimestamp';

describe('getUnixTimestamp', () => {
  it('returns a number', () => {
    const ts = getUnixTimestamp();
    expect(typeof ts).toBe('number');
  });

  it('returns a value close to Date.now()/1000', () => {
    const ts = getUnixTimestamp();
    const expected = Math.floor(Date.now() / 1000);
    expect(Math.abs(ts - expected)).toBeLessThanOrEqual(2);
  });
});
