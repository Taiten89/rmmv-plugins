"use strict";

/*:
 * @plugindesc Taiten's Arcade_Shooter plugin.
 * @author Taiten - github.com/Taiten89/
 *
 * @help
 * OK to use for free even in commercial projects as long as it's acknowledged
 * in the credits or similar.
 *
 * Annotate any target events with <arcade_shooter-target:123>
 * (replace "123" with their HP).
 * Self-Switch A is set to ON once they are defeated.
 * Self-Switch A is also set to OFF in them once Arcade_Shooter is started.
 * Commands:
 *   start-arcade_shooter mapId x y
 *   stop-arcade_shooter
 *
 * @param shot_picture
 * @desc The "name" of the pictures that appear to be the shots fired.
 * @dir img/pictures/
 * @type file
 *
 * @param shot_blockers
 * @desc The Region IDs that block shots.
 * @type number[]
 * @default []
 */

globalThis.Taiten = globalThis.Taiten || {};
globalThis.super_funcs = globalThis.super_funcs || {};

Taiten.arcade_shooter =
{
    SHOT_PICTURE: PluginManager.parameters('Taiten-Arcade_Shooter').shot_picture,
    SHOT_BLOCKERS: {},
    SHOOT_INPUT: 'ok',
    is_active: false,
    last_picture_id: 100,
    orig_dataMap: null,
    orig_gameMap: null,
    orig_player: null,
    orig_bgm: {},
    orig_bgs: {},

    defaults:
    {
        max_shot_power: 60,
        range: 20,
    },
};

{  //  set shot blockers
const region_json = PluginManager.parameters('Taiten-Arcade_Shooter').shot_blockers;
const region_strs = JSON.parse(region_json);
for (const region_str of region_strs)
    // js converts integers to strings when accessing these later
    Taiten.arcade_shooter.SHOT_BLOCKERS[region_str] = true;
}

super_funcs.kfUr = Game_Interpreter.prototype.pluginCommand;
Game_Interpreter.prototype.pluginCommand = function (command, args) {
    if (command === 'start-arcade_shooter')
        Taiten.arcade_shooter.start(...args);
    if (command === 'stop-arcade_shooter')
        Taiten.arcade_shooter.stop();
    super_funcs.kfUr.call(this, command, args);
};

Taiten.arcade_shooter.start = function (mapId_str, x_str, y_str)
{
    Taiten.arcade_shooter.is_active = true;

    Taiten.arcade_shooter.orig_bgm = {...AudioManager.saveBgm()};
    Taiten.arcade_shooter.orig_bgs = {...AudioManager.saveBgs()};
    AudioManager.stopBgm();
    AudioManager.stopBgs();

    Taiten.arcade_shooter.store_orig();
    const Extended_Game_Player = Taiten.arcade_shooter.extend_Character(Game_Player);
    globalThis.$gamePlayer = new Extended_Game_Player();

    const mapId = Number(mapId_str);
    const x = Number(x_str);
    const y = Number(y_str);
    $gamePlayer.reserveTransfer(mapId, x, y, 8, 0);
};

Taiten.arcade_shooter.stop = function ()
{
    Taiten.arcade_shooter.is_active = false;

    $gamePlayer.arcade_shooter.destruct();

    AudioManager.playBgm(Taiten.arcade_shooter.orig_bgm, Taiten.arcade_shooter.orig_bgm.pos);
    AudioManager.playBgs(Taiten.arcade_shooter.orig_bgs);
    Taiten.arcade_shooter.orig_bgm = {};
    Taiten.arcade_shooter.orig_bgs = {};

    const mapId = Taiten.arcade_shooter.orig_gameMap.mapId();
    const x = 0;
    const y = 0;
    $gamePlayer.reserveTransfer(mapId, x, y, 2, 0);
};

Taiten.arcade_shooter.store_orig = function ()
{
    Taiten.arcade_shooter.orig_dataMap = $dataMap;
    Taiten.arcade_shooter.orig_gameMap = $gameMap;
    Taiten.arcade_shooter.orig_player = $gamePlayer;
};

Taiten.arcade_shooter.unstore_orig = function ()
{
    globalThis.$dataMap = Taiten.arcade_shooter.orig_dataMap;
    globalThis.$gameMap = Taiten.arcade_shooter.orig_gameMap;
    globalThis.$gamePlayer = Taiten.arcade_shooter.orig_player;
    Taiten.arcade_shooter.orig_dataMap = null;
    Taiten.arcade_shooter.orig_gameMap = null;
    Taiten.arcade_shooter.orig_player = null;
};

Taiten.arcade_shooter.reset_self_switches = function ()
{
    for (const ev of $gameMap.events()) {
        if (ev._erased)
            continue;
        if (! ('arcade_shooter-target' in ev.event().meta))
            continue;
        const key = [$gameMap.mapId(), ev.eventId(), 'A'];
        $gameSelfSwitches.setValue(key, false);
    }
};

Taiten.arcade_shooter.Shooter = class
{
    constructor (player) {
        this._ = player;

        this.is_initted = false;
        this.shots = [];
        this.hits = [];
        this.target_hp = {};

        for (const k in Taiten.arcade_shooter.defaults)
            this[k] = Taiten.arcade_shooter.defaults[k];
    }

    destruct () {
        for (const shot of this.shots)
            if (shot.state !== 'destructed')
                shot.destruct();
    }

    shoot () {
        const shot = new Taiten.arcade_shooter.Shot(this);

        for (let i=0; i<this.shots.length; i++)
            if (this.shots[i].state === 'destructed') {
                this.shots[i] = shot;
                return;
            }

        this.shots.push(shot);
    }

    hit (event, power) {
        let hp = -1;
        if (event.eventId() in this.target_hp)
            hp = this.target_hp[event.eventId()];
        else {
            hp = Number(event.event().meta['arcade_shooter-target']);
            this.target_hp[event.eventId()] = hp;
        }
        this.target_hp[event.eventId()] -= power;

        const hit = new Taiten.arcade_shooter.Hit(event, power);
        for (let i=0; i<this.hits.length; i++) {
            if (this.hits[i].state === 'destructed') {
                this.hits[i] = hit;
                return;
            }
            if (this.hits[i].event.eventId() === event.eventId()) {
                this.hits[i].add_power(power);
                return;
            }
        }
        this.hits.push(hit);
    }

    perform_transfer () {
        if (!this.is_initted) {
            globalThis.$gameMap = new Game_Map();
            this._.super_performTransfer();
            Taiten.arcade_shooter.reset_self_switches();
            this.is_initted = true;
            return;
        }
        if (!Taiten.arcade_shooter.is_active) {
            Taiten.arcade_shooter.unstore_orig();
            this._.super_performTransfer();
            return;
        }
    }

    update () {
        if (this._.canMove())
            this.update_input();
        for (const shot of this.shots)
            shot.update();
        for (const hit of this.hits)
            hit.update();
        this.update_kills();
    }

    update_input () {
        if (Input.isTriggered(Taiten.arcade_shooter.SHOOT_INPUT))
            this.shoot();
    }

    update_kills () {
        for (const [event_id_str,hp] of Object.entries(this.target_hp)) {
            const event_id = Number(event_id_str);
            if (hp <= 0) {
                if (this.is_event_gleaming(event_id))
                    continue;
                const key = [$gameMap.mapId(), event_id, 'A'];
                $gameSelfSwitches.setValue(key, true);
                const event = $gameMap.event(event_id);
                const new_hp = Number(event.event().meta['arcade_shooter-target']);
                this.target_hp[event_id] = new_hp;
            }
        }
    }

    is_event_gleaming (event_id) {
        for (const hit of this.hits) {
            const a = event_id === hit.event.eventId();
            const b = hit.state === 'gleaming';
            if (a && b)
                return true;
        }
        return false;
    }
};

Taiten.arcade_shooter.Shot = class extends Game_Character
{
    constructor (shooter) {
        super();

        this._ = shooter;
        this.range_remaining = this._.range;
        this.power = 1;
        this.state = 'loading';

        Taiten.arcade_shooter.last_picture_id--;
        if (Taiten.arcade_shooter.last_picture_id === 50)
            Taiten.arcade_shooter.last_picture_id = 99;
        this.picture_id = Taiten.arcade_shooter.last_picture_id;
        const name = Taiten.arcade_shooter.SHOT_PICTURE;
        $gameScreen.showPicture(this.picture_id, name, 0, -1, -1,
                                100, 100, 255, 0);
    }

    destruct () {
        $gameScreen.erasePicture(this.picture_id);
        this.state = 'destructed';
    }

    fire () {
        this.state = 'shooting';
    }

    update () {
        if (this.state === 'loading')
            this.update_load();
        else if (this.state === 'shooting')
            this.update_shoot();

        if (this.state !== 'destructed')
            this.move_picture();
    }
    update_load () {
        this._realX = this._._._realX;
        this._realY = this._._._realY - 1.0;

        this.power++;

        const a = !Input.isPressed(Taiten.arcade_shooter.SHOOT_INPUT);
        const b = this.power === this._.max_shot_power;
        if (a || b)
            this.fire();
    }
    update_shoot () {
        if (this.update_hits()) {
            this.destruct();
            return;
        }

        this._realY -= 0.3;
        this.range_remaining -= 0.3;
        if (this.range_remaining < 0.0) {
            this.destruct();
            return;
        }

        const __x = Math.round(this._realX);
        const __y = Math.round(this._realY);
        const x_pn_gap = __x - this._realX;
        const y_pn_gap = __y - this._realY;
        const _x = $gameMap.roundX(__x);
        const _y = $gameMap.roundY(__y);
        this._realX = _x - x_pn_gap;
        this._realY = _y - y_pn_gap;

        const region_id = $gameMap.regionId(_x, _y);
        if (Taiten.arcade_shooter.SHOT_BLOCKERS[region_id])
            this.destruct();
    }
    update_hits () {
        const x = Math.round(this._realX);
        const __y = Math.round(this._realY) - 1;
        const y = $gameMap.roundY(__y);
        for (const ev of $gameMap.eventsXy(x, y)) {
            const key = [$gameMap.mapId(), ev.eventId(), 'A'];
            const a = !$gameSelfSwitches.value(key);
            const b = 'arcade_shooter-target' in ev.event().meta;
            if (a && b) {
                this._.hit(ev, this.power);
                return true;
            }
        }
        return false;
    }

    move_picture () {
        const rel_power = this.power / this._.max_shot_power;
        const x = this.screenX();
        const y = this.screenY();
        const scaleXY = Math.round(rel_power * 100);
        $gameScreen.movePicture(this.picture_id, 1, x, y, scaleXY,
                                scaleXY, 255, 0, 1);
    }
};

Taiten.arcade_shooter.Hit = class
{
    constructor (event, power) {
        this.event = event;
        this.state = 'gleaming';
        this.gleam_remaining = power;
    }

    destruct () {
        this.state = 'destructed';
    }

    add_power (extra_power) {
        this.gleam_remaining += extra_power;
    }

    update () {
        if (this.state === 'gleaming')
            this.update_gleam();
    }
    update_gleam () {
        if (this.gleam_remaining % 3 === 0)
            this.event.setBlendMode(1);
        else
            this.event.setBlendMode(0);

        this.gleam_remaining--;
        if (this.gleam_remaining === 0)
            this.destruct();
    }
};

Taiten.arcade_shooter.extend_Character = (Base) =>
class extends Base
{
    initMembers () {
        super.initMembers();
        this.arcade_shooter = new Taiten.arcade_shooter.Shooter(this);
    }

    performTransfer () {
        this.arcade_shooter.perform_transfer();
    }
    super_performTransfer () {
        super.performTransfer();
    }
    update (sceneActive) {
        this.arcade_shooter.update();
        super.update(sceneActive);
    }
};

{  //  stop minigame instead of menu
    super_funcs.ChJe = Scene_Map.prototype.callMenu;
    Scene_Map.prototype.callMenu = function ()
    {
        if (Taiten.arcade_shooter.is_active)
            Taiten.arcade_shooter.stop();
        else
            super_funcs.ChJe.call(this);
    };
}
