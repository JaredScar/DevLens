import { TestBed } from '@angular/core/testing';
import { SpotlightService } from './spotlight.service';

describe('SpotlightService', () => {
  let service: SpotlightService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SpotlightService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start with closed state', () => {
    expect(service.open()).toBe(false);
  });

  describe('toggle', () => {
    it('should open when closed', () => {
      expect(service.open()).toBe(false);
      service.toggle();
      expect(service.open()).toBe(true);
    });

    it('should close when open', () => {
      service.show();
      expect(service.open()).toBe(true);
      service.toggle();
      expect(service.open()).toBe(false);
    });
  });

  describe('show', () => {
    it('should set open to true', () => {
      service.show();
      expect(service.open()).toBe(true);
    });

    it('should remain true when called multiple times', () => {
      service.show();
      service.show();
      expect(service.open()).toBe(true);
    });
  });

  describe('hide', () => {
    it('should set open to false', () => {
      service.show();
      expect(service.open()).toBe(true);
      service.hide();
      expect(service.open()).toBe(false);
    });

    it('should remain false when called multiple times', () => {
      service.hide();
      service.hide();
      expect(service.open()).toBe(false);
    });
  });
});
