import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  BoardState,
  Color,
  INITIAL_SETUP,
  Location,
  Pose,
  allOffState,
  cloneState,
  createCheckers,
  initialState,
  locationOf,
  sameLocation,
  stackAt,
} from './board.model';
import {
  BAR_CX,
  BAR_X,
  BOTTOM_Y,
  DIVIDER_X,
  G,
  HEIGHT,
  LEFT_X,
  MID_Y,
  RIGHT_X,
  TOP_Y,
  TRAY_CX,
  TRAY_X,
  WIDTH,
  checkerXY,
  isTop,
  locationAt,
  pointX,
  trianglePath,
} from './board.geometry';
import { SoundService } from './sound.service';
import { ActivatedRoute } from '@angular/router';
import { GameService } from '../services/game.service';
import { MoveResponse } from '../models/move-response';
import { apiErrorMessage } from '../auth/api-error';
import { firstValueFrom, interval, Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { GameSocketService } from '../services/game-socket.service';
import { GameResponse } from '../models/game-response';
import { GamePlayerResponse } from '../models/game-player-response';
import { LegalMoveResponse } from '../models/legal-move-response';
import { fromBackendPosition, toBackendPosition, toBoardState } from './board-state.adapter';
import { Router } from '@angular/router';

interface RenderedChecker {
  id: number;
  color: Color;
  x: number;
  y: number;
  lift: number;
  squash: number;
  flying: boolean;
  slab: boolean;
  selected: boolean;
  highlighted: boolean;
}

interface Die {
  color: Color;
  value: number;
  x: number;
  y: number;
  rot: number;
  lift: number;
}

interface DragState {
  id: number;
  pointerId: number;
  startX: number;
  startY: number;
  offX: number;
  offY: number;
  started: boolean;
  startedAt: number;
}

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

@Component({
  selector: 'app-board',
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardComponent implements OnInit, OnDestroy {
  readonly sound = inject(SoundService);
  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  

  // --- geometrija za template ---
  readonly W = WIDTH;
  readonly H = HEIGHT;
  readonly G = G;
  readonly LEFT_X = LEFT_X;
  readonly RIGHT_X = RIGHT_X;
  readonly BAR_X = BAR_X;
  readonly BAR_CX = BAR_CX;
  readonly DIVIDER_X = DIVIDER_X;
  readonly TRAY_X = TRAY_X;
  readonly TRAY_CX = TRAY_CX;
  readonly TOP_Y = TOP_Y;
  readonly BOTTOM_Y = BOTTOM_Y;
  readonly MID_Y = MID_Y;
  readonly HALF_W = 6 * G.pointW;
  readonly PLAY_H = G.playH;
  readonly pointList = Array.from({ length: 24 }, (_, i) => i + 1);
  readonly pips = PIPS;
  readonly framePath = this.buildFramePath();
  readonly pointX = pointX;
  readonly trianglePath = trianglePath;
  readonly isTop = isTop;

  // --- stanje ---
  private readonly checkers = createCheckers();
  readonly state = signal<BoardState>(allOffState(this.checkers));
  private readonly overrides = signal<ReadonlyMap<number, Pose>>(new Map());
  readonly selected = signal<number | null>(null);
  readonly busy = signal(false);
  readonly dice = signal<Die[]>([]);
  readonly status = signal('Klikni ili prevuci kružić.');
  private drag: DragState | null = null;
  private destroyed = false;
  private readonly route = inject(ActivatedRoute);
  private readonly gameService = inject(GameService);
  readonly gameId = Number(this.route.snapshot.queryParamMap.get('gameId'));
  readonly moves = signal<MoveResponse[]>([]);
  readonly errorMessage = signal('');
  private readonly auth = inject(AuthService);
  private readonly socket = inject(GameSocketService);
  private readonly subscriptions = new Subscription();
  private players: GamePlayerResponse[] = [];
  readonly myColor = signal<Color | null>(null);
  readonly turnColor = signal<Color | null>(null);
  readonly game = signal<GameResponse | null>(null);
  readonly legalMoves = signal<LegalMoveResponse[]>([]);
  readonly showTurnPopup = signal(false);
  private lastTurnWasMine = false;
  readonly turnPopupMessage = signal('');
  readonly showGameResult = signal(false);
readonly gameResultMessage = signal('');
private gameResultShown = false;
  private readonly router = inject(Router);
  readonly showExitModal = signal(false);
  private noMovesPopupShownForTurn = -1;

  readonly canRoll = computed(() => {
    const g = this.game();
    if (!g || g.status !== 'IN_PROGRESS') return false;
    if (g.currentTurnUserId === null) {
      const myDie = this.myColor() === 'black' ? g.openingBlackDie : g.openingWhiteDie;
      return this.myColor() !== null && myDie === null;
    }
    return this.turnColor() === this.myColor() && g.currentState.dice.length === 0;
  });

  /** Pozicije svih kružića izračunate iz stanja table. */
  private readonly layout = computed(() => {
    const s = this.state();
    const map = new Map<number, { x: number; y: number; loc: Location; order: number }>();
    let order = 0;
    const place = (loc: Location, ids: number[]) =>
      ids.forEach((id, i) => map.set(id, { ...checkerXY(loc, i, ids.length), loc, order: order++ }));
    for (let p = 1; p <= 24; p++) place({ kind: 'point', index: p }, s.points[p]);
    for (const c of ['white', 'black'] as Color[]) {
      place({ kind: 'bar', color: c }, s.bar[c]);
      place({ kind: 'off', color: c }, s.off[c]);
    }
    return map;
  });

  readonly rendered = computed<RenderedChecker[]>(() => {
    const movable = this.movableCheckers();
    const layout = this.layout();
    const ov = this.overrides();
    const sel = this.selected();
    const list: (RenderedChecker & { order: number })[] = [];
    for (const c of this.checkers) {
      const l = layout.get(c.id)!;
      const o = ov.get(c.id);
      list.push({
        id: c.id,
        color: c.color,
        x: o ? o.x : l.x,
        y: o ? o.y : l.y,
        lift: o ? o.lift : 0,
        squash: o?.squash ?? 1,
        flying: !!o,
        slab: !o && l.loc.kind === 'off',
        selected: sel === c.id,
        // kružići u letu se crtaju poslednji (iznad svega)
        order: o ? 1000 + l.order : l.order,
        highlighted: movable.includes(c.id),
      });
    }
    return list.sort((a, b) => a.order - b.order);
  });

  readonly targets = computed<Location[]>(() => {
    const id = this.selected();
    return id === null ? [] : this.legalTargets(id);
  });
 readonly movableCheckers = computed(() => {

  return this.checkers
    .filter(c =>
      this.topOf(c.id) === c.id &&
      this.legalTargets(c.id).length > 0
    )
    .map(c => c.id);
});
  readonly targetPoints = computed(() =>
    this.targets()
      .filter((t): t is { kind: 'point'; index: number } => t.kind === 'point')
      .map((t) => {
        const s = this.state();
        const color = this.colorOf(this.selected()!);
        const own = s.points[t.index].filter((id) => this.colorOf(id) === color).length;
        const ghost = checkerXY(t, own, own + 1);
        return { index: t.index, path: trianglePath(t.index), gx: ghost.x, gy: ghost.y };
      }),
  );

  readonly offTarget = computed(() => {
    const t = this.targets().find((t) => t.kind === 'off');
    return t ? (t as { color: Color }).color : null;
  });

  ngOnInit(): void {
    if (this.gameId) {
      this.loadGame();
      this.loadMoves();
    } else {
      void this.newGame();
    }
  }

  private loadGame(): void {
    this.gameService.getPlayers(this.gameId).subscribe({
      next: (players) => {
        this.players = players;
        const mine = players.find((p) => p.username === this.auth.username());
        this.myColor.set(this.colorFromBackend(mine?.color));
        this.refreshGame();
      },
      error: (error) => this.errorMessage.set(apiErrorMessage(error, 'Ne mogu da učitam igrače.')),
    });
    this.subscriptions.add(this.socket.watchGame(this.gameId).subscribe((game) => this.applyGame(game)));
    this.subscriptions.add(interval(3000).subscribe(() => this.refreshGame()));
  }

  private refreshGame(): void {
    this.gameService.getGame(this.gameId).subscribe({
      next: (game) => this.applyGame(game),
      error: (error) => this.errorMessage.set(apiErrorMessage(error, 'Ne mogu da učitam igru.')),
    });
  }

  /** Primenjuje stanje sa servera. Protivnikove poteze i bacanje animira pre prikaza. */
  private applyGame(game: GameResponse, animate = true): void {
    if (this.drag || this.busy()) return;
    if (animate && this.game()) {
      void this.animateServerUpdate(game);
      return;
    }
    this.renderGame(game);
  }

  /** Animira protivnikovo bacanje i pomeranje kamenja, pa tek onda prikazuje novo stanje. */
  private async animateServerUpdate(game: GameResponse): Promise<void> {
    const prev = this.game()!;
    const next = toBoardState(game.currentState);
    const moved = [...this.layout().keys()].filter((id) => {
      const a = locationOf(this.state(), id);
      const b = locationOf(next, id);
      return a && b && !sameLocation(a, b);
    });
    const movedToOff = moved.some(id => {
  const before = locationOf(this.state(), id);
  const after = locationOf(next, id);

  return after?.kind === 'off' &&
         before?.kind !== 'off';
});
    const rolled = prev.currentState.dice.length === 0 && game.currentState.dice.length > 0;
    if (!moved.length && !rolled) {
      this.renderGame(game);
      return;
    }

    const turnPlayer = this.players.find((p) => p.userId === game.currentTurnUserId);
    this.busy.set(true);
    try {
      if (rolled) await this.rollDice(this.colorFromBackend(turnPlayer?.color) ?? 'white', game.currentState.dice);
      const starts = new Map(moved.map((id) => [id, this.currentPose(id)] as const));
      this.state.set(next);
      for (const id of moved) this.setPose(id, starts.get(id)!);
      for (const id of moved) await this.fly(id, starts.get(id)!, { speed: 1.1 });
   
    } finally {
      this.busy.set(false);
      this.renderGame(game);
    }
  }

  /** Prikazuje stanje na tabli bez animacije. */
  private renderGame(game: GameResponse): void {
    const prev = this.game();
    const changed = !prev
      || prev.turnNumber !== game.turnNumber
      || prev.status !== game.status
      || JSON.stringify(prev.currentState) !== JSON.stringify(game.currentState);
    this.game.set(game);
 if (
  game.status === 'FINISHED' &&
  !this.gameResultShown
) {

  this.gameService.getPlayers(this.gameId).subscribe(players => {

    this.players = players;

    const me = players.find(
      p => p.username === this.auth.username()
    );

    this.gameResultMessage.set(
      me?.winner
        ? '🏆 YOU WON!'
        : '💀 YOU LOST!'
    );

    this.showGameResult.set(true);
    this.gameResultShown = true;
  });

}
    if (prev && changed) this.loadMoves();
    this.state.set(toBoardState(game.currentState));
    this.overrides.set(new Map());
    const turnPlayer = this.players.find((p) => p.userId === game.currentTurnUserId);
    this.turnColor.set(this.colorFromBackend(turnPlayer?.color));
const isMyTurn =
  this.turnColor() !== null &&
  this.turnColor() === this.myColor();

if (
  this.turnColor() !== null &&
  isMyTurn !== this.lastTurnWasMine
) {

  this.turnPopupMessage.set(
    isMyTurn
      ? "🎲 It's your turn!"
      : "⏳ Opponent's turn"
  );

  this.showTurnPopup.set(true);

  setTimeout(() => {
    this.showTurnPopup.set(false);
  }, 2500);

  if (isMyTurn) {
    this.sound.clack(1.3);
  }
}

this.lastTurnWasMine = isMyTurn;
    const openingDice = [game.openingWhiteDie, game.openingBlackDie].filter((d): d is number => d !== null);
    const shownDice = game.currentTurnUserId === null ? openingDice : game.currentState.dice;
    this.dice.set(shownDice.length ? this.staticDice(this.turnColor() ?? 'white', shownDice) : []);

    if (game.status !== 'IN_PROGRESS' || this.turnColor() === null || this.turnColor() !== this.myColor()) {
      this.legalMoves.set([]);
      return;
    }
  this.gameService.getLegalMoves(this.gameId).subscribe({
  next: (moves) => {
    if (this.game() === game) {

      this.legalMoves.set(moves);

      if (
        moves.length === 0 &&
        game.currentState.dice.length > 0 &&
        game.turnNumber !== this.noMovesPopupShownForTurn
      ) {

        this.noMovesPopupShownForTurn = game.turnNumber;

        this.turnPopupMessage.set(
          '🚫 No legal moves. Turn passes automatically.'
        );

        this.showTurnPopup.set(true);

        setTimeout(() => {
          this.showTurnPopup.set(false);
        }, 2500);
      }
    }
  }
});
  }

  private colorFromBackend(value: GamePlayerResponse['color'] | undefined): Color | null {
    return value ? (value.toLowerCase() as Color) : null;
  }

  /** Kockice koje je server bacio, bez animacije. */
  private staticDice(color: Color, values: number[]): Die[] {
  const halfX = color === 'white' ? RIGHT_X : LEFT_X;

  const offsets =
    values.length === 4
      ? [-60, -20, 20, 60]
      : [-34, 34];

  return values.map((value, i) => ({
    color,
    value,
    x: halfX + this.HALF_W / 2 + offsets[i],
    y: MID_Y,
    rot: 0,
    lift: 0,
  }));
}
  private loadMoves(): void {
    if (!this.gameId) {
      this.errorMessage.set('Nedostaje gameId u adresi.');
      return;
    }
    this.gameService.getMoves(this.gameId).subscribe({
      next: moves => this.moves.set(moves),
      error: error => this.errorMessage.set(apiErrorMessage(error, 'Ne mogu da učitam poteze.'))
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.subscriptions.unsubscribe();
  }

  colorOf(id: number): Color {
    return id < 15 ? 'white' : 'black';
  }

  // ======================================================================
  //  Pravila kretanja (za sada "slobodan" režim: smer + blokade, bez kockica)
  // ======================================================================

  /** Odredišta koja je server prihvatio za trenutne kockice, bez duplikata. */
  private serverTargets(id: number): Location[] {
    const color = this.myColor();
    const loc = locationOf(this.state(), id);
    if (!color || !loc || this.colorOf(id) !== color) return [];
    const from = toBackendPosition(loc);
    const targets = new Map<number, Location>();
    for (const m of this.legalMoves()) {
      if (m.fromPosition === from) targets.set(m.toPosition, fromBackendPosition(m.toPosition, color));
    }
    return [...targets.values()];
  }

  legalTargets(id: number): Location[] {
    if (this.gameId) return this.serverTargets(id);
    const s = this.state();
    const color = this.colorOf(id);
    const loc = locationOf(s, id);
    if (!loc || loc.kind === 'off') return [];
    if (s.bar[color].length > 0 && loc.kind !== 'bar') return [];

    const dir = color === 'white' ? -1 : 1;
    const from = loc.kind === 'bar' ? (color === 'white' ? 25 : 0) : loc.index;
    const blocked = (p: number) => s.points[p].filter((x) => this.colorOf(x) !== color).length >= 2;
    const result: Location[] = [];
    const maxSteps = loc.kind === 'bar' ? 6 : 24;
    for (let step = 1; step <= maxSteps; step++) {
      const p = from + dir * step;
      if (p < 1 || p > 24) break;
      if (!blocked(p)) result.push({ kind: 'point', index: p });
    }

    const home = (p: number) => (color === 'white' ? p <= 6 : p >= 19);
    const allHome = this.checkers
      .filter((c) => c.color === color)
      .every((c) => {
        const l = locationOf(s, c.id)!;
        return l.kind === 'off' || (l.kind === 'point' && home(l.index));
      });
    if (allHome) result.push({ kind: 'off', color });
    return result;
  }

  private isLegal(id: number, to: Location): boolean {
    return this.legalTargets(id).some((t) => sameLocation(t, to));
  }

  /** Kružić koji se pomera kad se klikne bilo koji kružić iz gomile = onaj na vrhu. */
  private topOf(id: number): number | null {
    const s = this.state();
    const loc = locationOf(s, id);
    if (!loc || loc.kind === 'off') return null;
    const stack = stackAt(s, loc);
    return stack[stack.length - 1] ?? null;
  }

  // ======================================================================
  //  Animacije
  // ======================================================================

  private currentPose(id: number): Pose {
    const o = this.overrides().get(id);
    if (o) return { ...o };
    const l = this.layout().get(id)!;
    return { x: l.x, y: l.y, lift: 0 };
  }

  private setPose(id: number, pose: Pose | null): void {
    this.overrides.update((m) => {
      const next = new Map(m);
      if (pose) next.set(id, pose);
      else next.delete(id);
      return next;
    });
  }

  /**
   * "Let" kružića od trenutne poze do mesta koje mu pripada po stanju table.
   * Cilj se čita svaki frejm, pa ako se gomila u međuvremenu sabije - kružić to prati.
   */
  private fly(id: number, start: Pose, opts: { speed?: number; arc?: number } = {}): Promise<void> {
    return new Promise((resolve) => {
      const target0 = this.layout().get(id)!;
      const dist = Math.hypot(target0.x - start.x, target0.y - start.y);
      const duration = Math.min(1050, Math.max(380, 330 + dist * 0.5)) / (opts.speed ?? 1);
      const arc = opts.arc ?? 0.14;
      const t0 = performance.now();
      const landMs = 170;

      const frame = (now: number) => {
        if (this.destroyed) return resolve();
        const target = this.layout().get(id)!;
        const raw = Math.min(1, (now - t0) / duration);

        if (raw < 1) {
          const t = easeInOut(raw);
          // kvadratna bezier kriva - blag luk "na gore"
          const dx = target.x - start.x;
          const dy = target.y - start.y;
          const len = Math.hypot(dx, dy) || 1;
          let nx = -dy / len;
          let ny = dx / len;
          if (ny > 0) {
            nx = -nx;
            ny = -ny;
          }
          const cx = (start.x + target.x) / 2 + nx * len * arc;
          const cy = (start.y + target.y) / 2 + ny * len * arc;
          const x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * cx + t * t * target.x;
          const y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * cy + t * t * target.y;
          const lift =
            raw < 0.22
              ? lerp(start.lift, 1, easeOut(raw / 0.22))
              : raw > 0.78
                ? lerp(1, 0, Math.pow((raw - 0.78) / 0.22, 2))
                : 1;
          this.setPose(id, { x, y, lift });
          requestAnimationFrame(frame);
          return;
        }

        // spuštanje: kratak "squash" posle udarca o tablu
        const landT = (now - t0 - duration) / landMs;
        if (landT < 1) {
          this.setPose(id, { x: target.x, y: target.y, lift: 0, squash: 1 - 0.07 * Math.sin(Math.PI * landT) });
          requestAnimationFrame(frame);
          return;
        }
        this.setPose(id, null);
        resolve();
      };

      // zvuk tačno u trenutku dodira
      setTimeout(() => !this.destroyed && this.sound.clack(0.9), duration);
      requestAnimationFrame(frame);
    });
  }

  /** Pomeri kružić na lokaciju (sa animacijom i izbacivanjem protivnika ako je "blot"). */
  async move(id: number, to: Location, opts: { start?: Pose; speed?: number } = {}): Promise<void> {
    if (this.gameId) return this.sendMove(id, to);
    const start = opts.start ?? this.currentPose(id);
    const s = cloneState(this.state());
    const from = locationOf(s, id)!;
    const fromStack = stackAt(s, from);
    fromStack.splice(fromStack.indexOf(id), 1);

    let victim: number | null = null;
    if (to.kind === 'point') {
      const opp = s.points[to.index].filter((x) => this.colorOf(x) !== this.colorOf(id));
      if (opp.length === 1) {
        victim = opp[0];
        // protivnički kružić ostaje "zamrznut" na mestu dok ga naš ne udari
        this.setPose(victim, this.currentPose(victim));
        s.points[to.index] = s.points[to.index].filter((x) => x !== victim);
        s.bar[this.colorOf(victim)].push(victim);
      }
    }
    stackAt(s, to).push(id);

    this.setPose(id, start);
    this.state.set(s);
    await this.fly(id, start, { speed: opts.speed });
   if (to.kind === 'off') {
  this.sound.home();
}

    if (victim !== null) {
      this.sound.clack(1.2);
      const vp = this.currentPose(victim);
      await this.fly(victim, { ...vp, lift: 0.6 }, { arc: 0.25, speed: 1.1 });
    }
  }

  /** Šalje potez serveru. Tabla se menja tek kad server potvrdi novo stanje. */
  private async sendMove(id: number, to: Location): Promise<void> {
    const from = locationOf(this.state(), id);
    const legal = from
      ? this.legalMoves().find(
          (m) => m.fromPosition === toBackendPosition(from) && m.toPosition === toBackendPosition(to),
        )
      : undefined;
    if (!legal) {
      this.overrides.set(new Map());
      this.refreshGame();
      return;
    }

    this.busy.set(true);
    try {
      const bearingOff = to.kind === 'off';
      const game = await firstValueFrom(
        this.gameService.makeMove(this.gameId, {
          fromPosition: legal.fromPosition,
          toPosition: legal.toPosition,
          diceValue: legal.diceValue,
        }),
      );
      if (bearingOff) {
  this.sound.home();
}

      this.errorMessage.set('');
      this.busy.set(false);
      this.renderGame(game);
    } catch (error) {
      this.busy.set(false);
      this.overrides.set(new Map());
      this.errorMessage.set(apiErrorMessage(error as HttpErrorResponse, 'Potez nije prihvaćen.'));
      this.refreshGame();
    }
  }

  // ======================================================================
  //  Interakcija: klik i drag & drop
  // ======================================================================

  private toSvg(ev: PointerEvent): { x: number; y: number } {
    const svg = this.svgRef().nativeElement;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x, y: p.y };
  }

  onCheckerDown(ev: PointerEvent, clickedId: number): void {
    ev.stopPropagation();
    if (this.busy() || ev.button !== 0) return;
    const p = this.toSvg(ev);

    // ako je nešto selektovano a kliknuto je na kružić u ciljnom polju -> potez
    const sel = this.selected();
    if (sel !== null && clickedId !== sel) {
      const loc = locationAt(p.x, p.y, this.colorOf(sel));
      if (loc && this.isLegal(sel, loc)) {
        this.selected.set(null);
        void this.move(sel, loc);
        return;
      }
    }

    const id = this.topOf(clickedId);

if (id === null || this.overrides().has(id)) {
  return;
}

if (this.gameId) {
  const myColor = this.myColor();

  if (!myColor || this.colorOf(id) !== myColor) {
    return;
  }

  if (this.turnColor() !== myColor) {
    return;
  }
}
    const pose = this.currentPose(id);
    this.drag = {
      id,
      pointerId: ev.pointerId,
      startX: p.x,
      startY: p.y,
      offX: pose.x - p.x,
      offY: pose.y - p.y,
      started: false,
      startedAt: 0,
    };
    this.svgRef().nativeElement.setPointerCapture(ev.pointerId);
  }

  onPointerMove(ev: PointerEvent): void {
    const d = this.drag;
    if (!d || ev.pointerId !== d.pointerId) return;
    const p = this.toSvg(ev);
    if (!d.started) {
      if (Math.hypot(p.x - d.startX, p.y - d.startY) < 6) return;
      d.started = true;
      d.startedAt = performance.now();
      this.selected.set(d.id);
      this.sound.clack(0.25);
    }
    // kružić se blago "centrira" ispod prsta/kursora dok se vuče
    const k = Math.min(1, (performance.now() - d.startedAt) / 160);
    d.offX *= 0.92;
    d.offY *= 0.92;
    this.setPose(d.id, { x: p.x + d.offX, y: p.y + d.offY, lift: easeOut(k) });
  }

  onPointerUp(ev: PointerEvent): void {
    const d = this.drag;
    if (!d || ev.pointerId !== d.pointerId) return;
    this.drag = null;

    if (!d.started) {
      // običan klik - selekcija
      const was = this.selected() === d.id;
      this.selected.set(was ? null : d.id);
      if (!was && this.legalTargets(d.id).length === 0) {
        this.status.set('Ovaj kružić trenutno nema gde da ide.');
      } else {
        this.status.set('Klikni ili prevuci kružić.');
      }
      return;
    }

    const p = this.toSvg(ev);
    const pose = this.currentPose(d.id);
    const loc = locationAt(p.x, p.y, this.colorOf(d.id));
    this.selected.set(null);
    if (loc && this.isLegal(d.id, loc)) {
      void this.move(d.id, loc, { start: pose });
    } else {
      // vraćanje na staro mesto
      void this.fly(d.id, pose, { arc: 0.05, speed: 1.3 });
    }
  }

  onBoardDown(ev: PointerEvent): void {
    if (this.busy()) return;
    const sel = this.selected();
    if (sel === null) return;
    const p = this.toSvg(ev);
    const loc = locationAt(p.x, p.y, this.colorOf(sel));
    this.selected.set(null);
    if (loc && this.isLegal(sel, loc)) void this.move(sel, loc);
  }

  // ======================================================================
  //  Kockice
  // ======================================================================

  async rollDice(color: Color = 'white', values?: number[]): Promise<void> {
    const final = values ?? [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    // beli baca u desnoj polovini, crni u levoj
    const halfX = color === 'white' ? RIGHT_X : LEFT_X;
    const fromX = color === 'white' ? DIVIDER_X - 10 : LEFT_X + 10;
    const sign = color === 'white' ? -1 : 1;
    const single = final.length === 1;
   const offsets =
  final.length === 4
    ? [-60, -20, 20, 60]
    : single
      ? [0]
      : [-34, 34];

const ends = final.map((_, i) => ({
  x: halfX + this.HALF_W / 2 + offsets[i],
  y: MID_Y - 4 + Math.random() * 8,
}));
    const starts = ends.map((_, i) => ({ x: fromX, y: MID_Y + (i ? 70 : -70) * Math.random() }));
    const spins = ends.map(() => sign * (540 + Math.random() * 360));
    const endRot = ends.map(() => -12 + Math.random() * 24);
    const duration = 950;
    const t0 = performance.now();
    let lastFace = 0;
    let faces = final.map(() => 1 + Math.floor(Math.random() * 6));
    this.sound.rattle(0.75);

    await new Promise<void>((resolve) => {
      const frame = (now: number) => {
        if (this.destroyed) return resolve();
        const raw = Math.min(1, (now - t0) / duration);
        if (raw < 0.72 && now - lastFace > 70) {
          faces = faces.map(() => 1 + Math.floor(Math.random() * 6));
          lastFace = now;
        }
        const settled = raw >= 0.72;
        this.dice.set(
          ends.map((e, i) => {
            const t = easeOut(raw);
            const bounce = Math.abs(Math.sin(raw * Math.PI * 3.2)) * Math.pow(1 - raw, 2);
            return {
              color,
              value: settled ? final[i] : faces[i],
              x: lerp(starts[i].x, e.x, t),
              y: lerp(starts[i].y, e.y, t),
              rot: lerp(spins[i], endRot[i], t),
              lift: bounce,
            };
          }),
        );
        if (raw < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  // ======================================================================
  //  Nova partija / demo
  // ======================================================================

  async newGame(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.selected.set(null);
    this.dice.set([]);
    this.status.set('Postavljanje table...');

    const anyOnBoard = this.state().off.white.length + this.state().off.black.length < 30;
    if (anyOnBoard) {
      this.state.set(allOffState(this.checkers));
      await sleep(650);
    } else {
      await sleep(350);
    }

    // kružići "lete" iz kutije na početne pozicije, naizmenično beli/crni
    const order: { point: number; color: Color }[] = [];
    const queues = INITIAL_SETUP.map((e) => ({ ...e }));
    while (queues.some((q) => q.count > 0)) {
      for (const q of queues) {
        if (q.count > 0) {
          order.push({ point: q.point, color: q.color });
          q.count--;
        }
      }
    }
    const flights: Promise<void>[] = [];
    for (const { point, color } of order) {
      const off = this.state().off[color];
      const id = off[off.length - 1];
      flights.push(this.move(id, { kind: 'point', index: point }, { speed: 1.15 }));
      await sleep(75);
    }
    await Promise.all(flights);
    this.busy.set(false);
    this.status.set('Klikni ili prevuci kružić.');
  }

  async playDemo(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.selected.set(null);
    this.dice.set([]);
    this.status.set('Demo partija...');

    // instant vraćanje na početnu poziciju (kružići klize na mesta)
    this.state.set(initialState(this.checkers));
    await sleep(700);

    const turns: { color: Color; dice: [number, number]; moves: [number | 'bar', number | 'off'][] }[] = [
      { color: 'white', dice: [3, 1], moves: [[8, 5], [6, 5]] },
      { color: 'black', dice: [5, 4], moves: [[12, 17], [12, 16]] },
      { color: 'white', dice: [6, 2], moves: [[24, 18], [18, 16]] },
      { color: 'black', dice: [4, 5], moves: [['bar', 4], [19, 24]] },
      { color: 'white', dice: [5, 6], moves: [['bar', 20], [13, 7]] },
    ];

    for (const turn of turns) {
      if (this.destroyed) return;
      this.status.set(`${turn.color === 'white' ? 'Beli' : 'Crni'} baca: ${turn.dice[0]} i ${turn.dice[1]}`);
      await this.rollDice(turn.color, turn.dice);
      await sleep(350);
      for (const [from, to] of turn.moves) {
        const s = this.state();
        const stack = from === 'bar' ? s.bar[turn.color] : s.points[from];
        const id = stack[stack.length - 1];
        const target: Location = to === 'off' ? { kind: 'off', color: turn.color } : { kind: 'point', index: to };
        await this.move(id, target);
        await sleep(260);
      }
      await sleep(400);
    }
    this.dice.set([]);
    this.busy.set(false);
    this.status.set('Klikni ili prevuci kružić.');
  }

  async onRollClick(): Promise<void> {
    if (this.gameId) return this.serverRoll();
    if (this.busy()) return;
    this.busy.set(true);
    await this.rollDice('white');
    const [a, b] = this.dice().map((d) => d.value);
    this.status.set(a === b ? `Dupla! ${a} i ${b}` : `Bačeno: ${a} i ${b}`);
    this.busy.set(false);
  }
exitGame(): void {
  void this.router.navigate(['/lobby']);
}
viewLeaderboard(): void {
  void this.router.navigate(['/leaderboard']);
}

  /** Traži bacanje od servera i animira kockice koje je server izabrao. */
  private async serverRoll(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const game = await firstValueFrom(this.gameService.roll(this.gameId));
      const opening = game.currentTurnUserId === null;
      const myDie = this.myColor() === 'black' ? game.openingBlackDie : game.openingWhiteDie;
      const values = opening ? [myDie].filter((d): d is number => d !== null) : game.currentState.dice;
      this.errorMessage.set('');
      await this.rollDice(this.myColor() ?? 'white', values);
      if (opening) this.status.set(`Početno bacanje: ${values[0]}`);
      else if (values[0] === values[1]) this.status.set(`Dupla! ${values[0]} i ${values[1]}`);
      else this.status.set(`Bačeno: ${values[0]} i ${values[1]}`);
      this.busy.set(false);
      this.applyGame(game, false);
    } catch (error) {
      this.busy.set(false);
      this.errorMessage.set(apiErrorMessage(error as HttpErrorResponse, 'Bacanje nije uspelo.'));
      this.refreshGame();
    }
  }

  // ======================================================================

  private buildFramePath(): string {
    const rect = (x: number, y: number, w: number, h: number) =>
      `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
    return [
      rect(0, 0, WIDTH, HEIGHT),
      rect(LEFT_X, TOP_Y, 6 * G.pointW, G.playH),
      rect(RIGHT_X, TOP_Y, 6 * G.pointW, G.playH),
      rect(TRAY_X, TOP_Y, G.trayW, G.playH),
    ].join(' ');
  }
  whitePlayer(): GamePlayerResponse | undefined {
  return this.players.find(p => p.color === 'WHITE');
}

blackPlayer(): GamePlayerResponse | undefined {
  return this.players.find(p => p.color === 'BLACK');
}


  pipX(v: number): number {
    return v * 11;
  }
}
