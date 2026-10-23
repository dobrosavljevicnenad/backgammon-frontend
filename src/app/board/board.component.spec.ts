import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { GamePlayerResponse } from '../models/game-player-response';
import { GameResponse } from '../models/game-response';
import { UserResponse } from '../models/user-response';
import { AuthService } from '../services/auth.service';
import { GameSocketService } from '../services/game-socket.service';
import { GameService } from '../services/game.service';
import { BoardComponent } from './board.component';
import { SoundService } from './sound.service';

describe('BoardComponent forfeiting', () => {
  let fixture: ComponentFixture<BoardComponent>;
  let component: BoardComponent;
  let root: HTMLElement;
  let gameService: jasmine.SpyObj<GameService>;
  let auth: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  let socketUpdates: Subject<GameResponse>;
  let finishRequest: Subject<GameResponse>;
  let activeGame: GameResponse;
  let players: GamePlayerResponse[];
  let user: UserResponse;
  let queryParams: Record<string, string>;

  beforeEach(async () => {
    players = [
      { id: 1, gameId: 7, userId: 1, username: 'alice', color: 'WHITE', winner: false },
      { id: 2, gameId: 7, userId: 2, username: 'bob', color: 'BLACK', winner: false },
    ];
    const points = Array<number>(25).fill(0);
    points[1] = 15;
    points[24] = -15;
    activeGame = {
      id: 7,
      roomId: 3,
      status: 'IN_PROGRESS',
      currentTurnUserId: 2,
      currentState: { points, whiteBar: 0, blackBar: 0, whiteOff: 0, blackOff: 0, dice: [] },
      turnNumber: 1,
      startedAt: '2026-10-23T20:00:00Z',
      finishedAt: null,
      openingWhiteDie: 3,
      openingBlackDie: 5,
    };
    user = {
      id: 1,
      username: 'alice',
      email: 'alice@example.test',
      role: 'USER',
      active: true,
      wins: 2,
      losses: 4,
      rating: 1184,
      createdAt: '2026-10-01T00:00:00Z',
    };
    queryParams = { gameId: '7' };
    socketUpdates = new Subject<GameResponse>();
    finishRequest = new Subject<GameResponse>();
    gameService = jasmine.createSpyObj<GameService>('GameService', [
      'getPlayers', 'getGame', 'getMoves', 'getLegalMoves', 'finishGame', 'roll', 'makeMove',
    ]);
    gameService.getPlayers.and.returnValue(of(players));
    gameService.getGame.and.returnValue(of(activeGame));
    gameService.getMoves.and.returnValue(of([]));
    gameService.getLegalMoves.and.returnValue(of([]));
    gameService.finishGame.and.returnValue(finishRequest);
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['me'], { username: signal('alice') });
    auth.me.and.returnValue(of(user));
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    const sound = jasmine.createSpyObj<SoundService>(
      'SoundService', ['toggle', 'clack', 'rattle', 'home'], { enabled: signal(false) },
    );

    await TestBed.configureTestingModule({
      imports: [BoardComponent],
      providers: [
        { provide: GameService, useValue: gameService },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
        { provide: SoundService, useValue: sound },
        { provide: GameSocketService, useValue: { watchGame: () => socketUpdates } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { get queryParamMap() { return convertToParamMap(queryParams); } } },
        },
      ],
    }).compileComponents();
  });

  function createBoard(): void {
    fixture = TestBed.createComponent(BoardComponent);
    component = fixture.componentInstance;
    root = fixture.nativeElement;
    fixture.detectChanges();
  }

  function button(text: string, parent: ParentNode = root): HTMLButtonElement {
    const match = Array.from(parent.querySelectorAll('button'))
      .find((element) => element.textContent?.trim() === text);
    if (!match) throw new Error(`Button not found: ${text}`);
    return match;
  }

  function dialog(): HTMLDialogElement {
    return root.querySelector('dialog')!;
  }

  function openConfirmation(): void {
    button('Forfeit Game', root.querySelector('.actions')!).click();
    fixture.detectChanges();
  }

  function finishedGame(): GameResponse {
    return { ...activeGame, status: 'FINISHED', finishedAt: '2026-10-23T20:10:00Z' };
  }

  function finishAsLoser(): void {
    gameService.getPlayers.and.returnValue(of(players.map((player) => ({
      ...player, winner: player.userId === 2,
    }))));
    finishRequest.next(finishedGame());
    finishRequest.complete();
    fixture.detectChanges();
  }

  it('places Forfeit Game immediately after Exit Game for a participant', () => {
    createBoard();
    const exit = button('Exit Game');
    expect(exit.nextElementSibling?.textContent?.trim()).toBe('Forfeit Game');
    expect(component.canForfeit()).toBeTrue();
  });

  it('does not show the toolbar action to spectators', () => {
    auth.username.set('spectator');
    createBoard();
    expect(root.querySelector('.actions')?.textContent).not.toContain('Forfeit Game');
    component.openForfeitModal();
    expect(dialog().open).toBeFalse();
  });

  it('does not show the toolbar action on the local/demo board', () => {
    queryParams = {};
    spyOn(BoardComponent.prototype, 'newGame').and.resolveTo();
    createBoard();
    expect(root.querySelector('.actions')?.textContent).not.toContain('Forfeit Game');
    expect(gameService.getGame).not.toHaveBeenCalled();
  });

  for (const status of ['FINISHED', 'ABANDONED'] as const) {
    it(`does not allow forfeiting a ${status} game`, () => {
      gameService.getGame.and.returnValue(of({ ...activeGame, status }));
      createBoard();
      expect(component.canForfeit()).toBeFalse();
      component.openForfeitModal();
      component.confirmForfeit();
      expect(gameService.finishGame).not.toHaveBeenCalled();
    });
  }

  for (const currentTurnUserId of [1, 2, null]) {
    it(`allows forfeiting with currentTurnUserId ${currentTurnUserId}`, () => {
      activeGame.currentTurnUserId = currentTurnUserId;
      createBoard();
      openConfirmation();
      expect(dialog().open).toBeTrue();
      component.confirmForfeit();
      expect(gameService.finishGame).toHaveBeenCalledOnceWith(7);
    });
  }

  it('allows the black participant to forfeit', () => {
    auth.username.set('bob');
    createBoard();
    expect(component.myColor()).toBe('black');
    openConfirmation();
    component.confirmForfeit();
    expect(gameService.finishGame).toHaveBeenCalledOnceWith(7);
  });

  it('opens a modal with Cancel focused and sends nothing before confirmation', () => {
    createBoard();
    openConfirmation();
    expect(dialog().open).toBeTrue();
    expect(dialog().textContent).toContain('Your opponent will win');
    expect(document.activeElement).toBe(button('Cancel', dialog()));
    expect(gameService.finishGame).not.toHaveBeenCalled();
    expect(auth.me).not.toHaveBeenCalled();
  });

  it('cancels without changing the game or statistics', () => {
    createBoard();
    openConfirmation();
    button('Cancel', dialog()).click();
    fixture.detectChanges();
    expect(dialog().open).toBeFalse();
    expect(component.showForfeitModal()).toBeFalse();
    expect(component.game()?.status).toBe('IN_PROGRESS');
    expect(gameService.finishGame).not.toHaveBeenCalled();
    expect(auth.me).not.toHaveBeenCalled();
  });

  it('supports Escape cancellation', () => {
    createBoard();
    openConfirmation();
    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(dialog().open).toBeFalse();
    expect(gameService.finishGame).not.toHaveBeenCalled();
  });

  it('requires an open confirmation before sending a finish request', () => {
    createBoard();
    component.confirmForfeit();
    expect(gameService.finishGame).not.toHaveBeenCalled();
  });

  it('submits once and blocks cancel, exit, rolling and moving while pending', async () => {
    activeGame.currentTurnUserId = 1;
    gameService.getLegalMoves.and.returnValue(of([
      { fromPosition: 1, toPosition: 2, diceValue: 1 },
    ]));
    createBoard();
    openConfirmation();
    button('Forfeit Game', dialog()).click();
    component.confirmForfeit();
    fixture.detectChanges();
    expect(button('Forfeiting...', dialog()).disabled).toBeTrue();
    expect(button('Cancel', dialog()).disabled).toBeTrue();
    expect(button('Roll dice').disabled).toBeTrue();
    expect(button('Exit Game').disabled).toBeTrue();
    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    component.exitGame();
    await component.onRollClick();
    await component.move(14, { kind: 'point', index: 2 });
    expect(dialog().open).toBeTrue();
    expect(gameService.finishGame).toHaveBeenCalledOnceWith(7);
    expect(gameService.roll).not.toHaveBeenCalled();
    expect(gameService.makeMove).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not open confirmation during another game action', () => {
    createBoard();
    component.busy.set(true);
    fixture.detectChanges();
    expect(button('Forfeit Game', root.querySelector('.actions')!).disabled).toBeTrue();
    component.openForfeitModal();
    expect(dialog().open).toBeFalse();
  });

  it('waits for an ongoing opponent animation before accepting confirmation', () => {
    createBoard();
    openConfirmation();
    component.busy.set(true);
    fixture.detectChanges();
    expect(button('Forfeit Game', dialog()).disabled).toBeTrue();
    component.confirmForfeit();
    expect(gameService.finishGame).not.toHaveBeenCalled();
    component.busy.set(false);
    fixture.detectChanges();
    button('Forfeit Game', dialog()).click();
    expect(gameService.finishGame).toHaveBeenCalledOnceWith(7);
  });

  it('applies the finished response, shows YOU LOST and displays server statistics', () => {
    createBoard();
    openConfirmation();
    component.confirmForfeit();
    finishAsLoser();
    expect(dialog().open).toBeFalse();
    expect(component.game()?.status).toBe('FINISHED');
    expect(component.canForfeit()).toBeFalse();
    expect(root.querySelector('.game-result-modal')?.textContent).toContain('YOU LOST');
    const statistics = root.querySelector('.loss-statistics');
    expect(statistics?.textContent).toContain('Rating1184');
    expect(statistics?.textContent).toContain('Losses4');
    expect(auth.me).toHaveBeenCalledTimes(1);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('shows a finish error in the modal and permits retry', () => {
    createBoard();
    openConfirmation();
    component.confirmForfeit();
    finishRequest.error(new HttpErrorResponse({
      status: 500, error: { message: 'Could not finish this game.' },
    }));
    fixture.detectChanges();
    expect(dialog().open).toBeTrue();
    expect(dialog().querySelector('[role="alert"]')?.textContent).toContain('Could not finish');
    expect(button('Forfeit Game', dialog()).disabled).toBeFalse();
    expect(component.game()?.status).toBe('IN_PROGRESS');
    expect(auth.me).not.toHaveBeenCalled();
    gameService.finishGame.and.returnValue(of(finishedGame()));
    button('Forfeit Game', dialog()).click();
    fixture.detectChanges();
    expect(gameService.finishGame).toHaveBeenCalledTimes(2);
    expect(component.showGameResult()).toBeTrue();
  });

  it('closes confirmation when the opponent finishes the game', () => {
    createBoard();
    openConfirmation();
    gameService.getPlayers.and.returnValue(of(players.map((player) => ({
      ...player, winner: player.userId === 1,
    }))));
    socketUpdates.next(finishedGame());
    fixture.detectChanges();
    expect(dialog().open).toBeFalse();
    expect(component.gameResultMessage()).toContain('YOU WON');
    expect(auth.me).not.toHaveBeenCalled();
    component.confirmForfeit();
    expect(gameService.finishGame).not.toHaveBeenCalled();
  });

  it('also detects completion by polling while confirmation is open', fakeAsync(() => {
    createBoard();
    openConfirmation();
    gameService.getGame.and.returnValue(of(finishedGame()));
    tick(3000);
    fixture.detectChanges();
    expect(dialog().open).toBeFalse();
    expect(component.showGameResult()).toBeTrue();
    expect(component.game()?.status).toBe('FINISHED');
    component.confirmForfeit();
    expect(gameService.finishGame).not.toHaveBeenCalled();
    fixture.destroy();
  }));

  it('deduplicates result and stats reads across socket and HTTP completion', () => {
    createBoard();
    openConfirmation();
    component.confirmForfeit();
    const resultRequest = new Subject<GamePlayerResponse[]>();
    const statisticsRequest = new Subject<UserResponse>();
    gameService.getPlayers.and.returnValue(resultRequest);
    auth.me.and.returnValue(statisticsRequest);
    socketUpdates.next(finishedGame());
    finishRequest.next(finishedGame());
    socketUpdates.next(finishedGame());
    expect(gameService.getPlayers).toHaveBeenCalledTimes(2);
    expect(component.resultLoading()).toBeTrue();
    resultRequest.next(players);
    resultRequest.complete();
    socketUpdates.next(finishedGame());
    expect(auth.me).toHaveBeenCalledTimes(1);
    expect(component.statisticsLoading()).toBeTrue();
    statisticsRequest.next(user);
    statisticsRequest.complete();
    expect(component.lossStatistics()?.rating).toBe(user.rating);
  });

  it('waits for the finish HTTP response before reading statistics if the socket arrives first', () => {
    createBoard();
    openConfirmation();
    component.confirmForfeit();
    socketUpdates.next(finishedGame());
    expect(component.gameResultMessage()).toContain('YOU LOST');
    expect(auth.me).not.toHaveBeenCalled();
    finishRequest.next(finishedGame());
    expect(auth.me).toHaveBeenCalledTimes(1);
    expect(component.lossStatistics()).toEqual({ rating: user.rating, losses: user.losses });
  });

  it('ignores stale active-game updates after finalization', () => {
    createBoard();
    openConfirmation();
    component.confirmForfeit();
    finishAsLoser();
    const finalState = component.state();
    socketUpdates.next({
      ...activeGame, currentState: { ...activeGame.currentState, dice: [1, 2] },
    });
    expect(component.game()?.status).toBe('FINISHED');
    expect(component.state()).toBe(finalState);
    expect(component.busy()).toBeFalse();
    expect(component.canForfeit()).toBeFalse();
  });

  it('keeps a socket-confirmed result if the finish HTTP response fails', () => {
    createBoard();
    openConfirmation();
    component.confirmForfeit();
    socketUpdates.next(finishedGame());
    finishRequest.error(new HttpErrorResponse({ status: 0 }));
    fixture.detectChanges();
    expect(dialog().open).toBeFalse();
    expect(component.forfeiting()).toBeFalse();
    expect(component.forfeitError()).toBe('');
    expect(component.gameResultMessage()).toContain('YOU LOST');
    expect(component.lossStatistics()?.rating).toBe(user.rating);
    expect(gameService.finishGame).toHaveBeenCalledTimes(1);
  });

  it('shows a result read error and retries without forfeiting again', () => {
    createBoard();
    openConfirmation();
    component.confirmForfeit();
    gameService.getPlayers.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    finishRequest.next(finishedGame());
    fixture.detectChanges();
    expect(root.querySelector('.game-result-modal [role="alert"]')?.textContent)
      .toContain('Could not load the game result.');
    gameService.getPlayers.and.returnValue(of(players));
    button('Retry result').click();
    fixture.detectChanges();
    expect(component.gameResultMessage()).toContain('YOU LOST');
    expect(component.lossStatistics()?.losses).toBe(4);
    expect(gameService.finishGame).toHaveBeenCalledTimes(1);
  });

  it('shows a statistics read error and retries only the statistics request', () => {
    createBoard();
    openConfirmation();
    component.confirmForfeit();
    auth.me.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    finishAsLoser();
    expect(root.querySelector('.game-result-modal [role="alert"]')?.textContent)
      .toContain('Could not load your updated statistics.');
    expect(component.gameResultMessage()).toContain('YOU LOST');
    expect(component.game()?.status).toBe('FINISHED');
    auth.me.and.returnValue(of(user));
    button('Retry statistics').click();
    fixture.detectChanges();
    expect(component.statisticsError()).toBe('');
    expect(component.lossStatistics()).toEqual({ rating: 1184, losses: 4 });
    expect(gameService.finishGame).toHaveBeenCalledTimes(1);
    expect(gameService.getPlayers).toHaveBeenCalledTimes(2);
  });

  it('keeps Exit Game as lobby navigation without a finish request', () => {
    createBoard();
    button('Exit Game').click();
    fixture.detectChanges();
    button('Leave').click();
    expect(router.navigate).toHaveBeenCalledOnceWith(['/lobby']);
    expect(gameService.finishGame).not.toHaveBeenCalled();
  });

  it('keeps result navigation to the leaderboard and lobby', () => {
    createBoard();
    openConfirmation();
    component.confirmForfeit();
    finishAsLoser();
    const result = root.querySelector('.game-result-modal')!;
    button('🏆 View Leaderboard', result).click();
    expect(router.navigate).toHaveBeenCalledWith(['/leaderboard']);
    button('Exit Game', result).click();
    expect(router.navigate).toHaveBeenCalledWith(['/lobby']);
  });

  it('unsubscribes from a pending finish request when the board is destroyed', () => {
    createBoard();
    openConfirmation();
    component.confirmForfeit();
    fixture.destroy();
    finishRequest.next(finishedGame());
    expect(component.game()?.status).toBe('IN_PROGRESS');
    expect(auth.me).not.toHaveBeenCalled();
  });
});
