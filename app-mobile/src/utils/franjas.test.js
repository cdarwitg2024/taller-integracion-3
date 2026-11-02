import { franjaRetiroActual } from './franjas';

describe('franjaRetiroActual', () => {
  test.each([
    [12,14,59,'12:00-12:15'],
    [12,15,0,'12:15-12:30'],
    [18,20,0,'18:15-18:30'],
    [23,59,59,'23:45-00:00'],
    [0,0,0,'00:00-00:15'],
  ])('a las %i:%i:%i genera %s', (h,m,s,id) => {
    expect(franjaRetiroActual(new Date(2026,0,15,h,m,s)).id).toBe(id);
  });
});
