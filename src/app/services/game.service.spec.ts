import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { GameService } from './game.service';

describe('GameService forfeiting', () => {
  it('posts to the existing finish endpoint with an empty body', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const service = TestBed.inject(GameService);
    const http = TestBed.inject(HttpTestingController);
    const response = { id: 7, status: 'FINISHED' };
    const next = jasmine.createSpy('next');

    service.finishGame(7).subscribe(next);

    const request = http.expectOne(`${environment.apiUrl}/api/games/7/finish`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush(response);
    expect(next).toHaveBeenCalledOnceWith(response);
    http.verify();
  });
});
