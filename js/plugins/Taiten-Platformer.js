"use strict";

/*:
 * @plugindesc Taiten's Platformer plugin.
 * @author Taiten - github.com/Taiten89/
 *
 * @help
 * OK to use for free even in commercial projects as long as it's acknowledged
 * in the credits or similar.
 *
 * Requires Taiten-Analog_Move (has the same conditions as this one).
 *
 * Commands:
 *   start-platformer mapId x y
 *   stop-platformer
 */

globalThis.Platformer = {
    JUMP_INPUT: 'ok',
    is_active: false,
    orig_dataMap: null,
    orig_gameMap: null,
    orig_player: null,
    orig_bgm: {},
    orig_bgs: {},

    defaults:
    {
        G: 9.8 / 60 / 2 / 4,  // assuming 2m field height; /4 because slower is more fun
        F_side: 0.3 * 9.8 / 60 / 2,
        F_jump: 0.075,
        jump_max: Math.round(0.13 * 60),
    },
};

super_funcs.hVnQ = Game_Interpreter.prototype.pluginCommand;
Game_Interpreter.prototype.pluginCommand = function (command, args)
{
    if (command === 'start-platformer')
        Platformer.start(...args);
    if (command === 'stop-platformer')
        Platformer.stop();
    super_funcs.hVnQ.call(this, command, args);
};

Platformer.start = function (mapId_str, x_str, y_str)
{
    Platformer.is_active = true;

    Platformer.orig_bgm = {...AudioManager.saveBgm()};
    Platformer.orig_bgs = {...AudioManager.saveBgs()};
    AudioManager.stopBgm();
    AudioManager.stopBgs();

    Platformer.store_orig();
    const Extended_Game_Player = Platformer.extend_Character(Game_Player);
    $gamePlayer = new Extended_Game_Player();

    const mapId = Number(mapId_str);
    const x = Number(x_str);
    const y = Number(y_str);
    $gamePlayer.reserveTransfer(mapId, x, y, 6, 0);
};

Platformer.stop = function ()
{
    Platformer.is_active = false;

    AudioManager.playBgm(Platformer.orig_bgm, Platformer.orig_bgm.pos);
    AudioManager.playBgs(Platformer.orig_bgs);
    Platformer.orig_bgm = {};
    Platformer.orig_bgs = {};

    const mapId = Platformer.orig_gameMap.mapId();
    const x = 0;
    const y = 0;
    $gamePlayer.reserveTransfer(mapId, x, y, 2, 0);
};

Platformer.store_orig = function ()
{
    Platformer.orig_dataMap = $dataMap;
    Platformer.orig_gameMap = $gameMap;
    Platformer.orig_player = $gamePlayer;
};

Platformer.unstore_orig = function ()
{
    $dataMap = Platformer.orig_dataMap;
    Platformer.orig_dataMap = null;
    $gameMap = Platformer.orig_gameMap;
    Platformer.orig_gameMap = null;
    $gamePlayer = Platformer.orig_player;
    Platformer.orig_player = null;
};

Platformer.Analog_Move_Player = class extends Analog_Move.Player {
    move_by_input () {
        if (Input.isTriggered(Platformer.JUMP_INPUT))
            this._.platformer_is_jump_triggered = true;
        if (!Input.isPressed(Platformer.JUMP_INPUT))
        {
            this._.platformer_is_jump_triggered = false;
            this._.platformer_jump_remaining = 0;
        }

        if (this._.canMove())
        {
            this._.platformer_move_by_direction_input();

            if (Input.isPressed(Platformer.JUMP_INPUT))
                this._.platformer_handle_jump_pressed();
        }
    }

    apply_ground_resistance () {}

    apply_speed_x ()
    {
        const super_result = super.apply_speed_x();
        if (!super_result)
        {
            this.speed_x = 0.0;
            this._._realX = this._._x;
        }
        // hack: discard super result;
        // drag-to-raster won't be provoked
        return true;
    }

    apply_speed_y ()
    {
        const super_result = super.apply_speed_y();
        if (!super_result)
        {
            this.speed_y = 0.0;
            this._._realY = this._._y;
        }
        // hack: discard super result;
        // drag-to-raster won't be provoked
        return true;
    }

    modify_and_apply_speed ()
    {
        this.accelerate_y(this._.platformer_G);

        if (this._.platformer_jump_remaining)
        {
            this.accelerate_y(-this._.platformer_F_jump);
            this._.platformer_jump_remaining--;
        }

        this._.platformer_apply_wind_resistance();
        if (this._.platformer_is_on_ground)
            this._.platformer_apply_ground_resistance();

        super.modify_and_apply_speed();

        this._.platformer_update_is_on_ground();
    }
};

Platformer.extend_Character = (Base) =>
class extends Base
{
    initMembers ()
    {
        super.initMembers();
        this.analog_move = new Platformer.Analog_Move_Player(this);

        this.platformer_is_initted = false;
        this.platformer_jump_remaining = 0;
        this.platformer_is_jump_triggered = false;
        this.platformer_is_on_ground = false;

        for (const k in Platformer.defaults)
            this["platformer_"+k] = Platformer.defaults[k];
    }

    performTransfer ()
    {
        if (!this.platformer_is_initted)
        {
            $gameMap = new Game_Map();
            super.performTransfer();
            this.platformer_is_initted = true;
            return;
        }

        if (!Platformer.is_active)
        {
            Platformer.unstore_orig();
            super.performTransfer();
            return;
        }
    }

    hasWalkAnime ()
    {
        if (!this.platformer_is_on_ground)
            return false;
        return super.hasWalkAnime();
    }
    locate (x, y)
    {
        super.locate(x, y);
        this.platformer_update_is_on_ground();
    }

    setDirection (dir)
    {
        if (dir === 2 || dir === 8)
            return;
        super.setDirection(dir);
    }

    platformer_move_by_direction_input ()
    {
        const direction = this.getInputDirection();
        this.setDirection(direction);
        if (this.platformer_is_on_ground)
        {
            if (direction === 4)
                this.analog_move.accelerate_x(-this.platformer_F_side);
            else if (direction === 6)
                this.analog_move.accelerate_x(+this.platformer_F_side);
            else
                this.platformer_brake_x();
        }
        else
        {
            if (direction === 4)
                this.analog_move.accelerate_x(-this.platformer_F_side / 4);
            else if (direction === 6)
                this.analog_move.accelerate_x(+this.platformer_F_side / 4);
        }
    }

    platformer_handle_jump_pressed ()
    {
        if (this.platformer_is_jump_triggered && this.platformer_is_on_ground)
        {
            this.platformer_jump_remaining = this.platformer_jump_max;
            this.platformer_is_jump_triggered = false;
        }
    }

    platformer_brake_x ()
    {
        this.analog_move.speed_x *= 0.75;
    }

    platformer_apply_wind_resistance ()
    {
        this.analog_move.speed_x *= 1.0 - 1.0 / 64.0;
        this.analog_move.speed_y *= 1.0 - 1.0 / 64.0;
    }

    platformer_apply_ground_resistance ()
    {
        this.analog_move.speed_x *= 1.0 - 1.0 / 32.0;
    }

    platformer_update_is_on_ground ()
    {
        const can_pass = this.canPass(this._x, this._y, 2);
        const has_gap = this._realY !== this._y;
        this.platformer_is_on_ground = !can_pass && !has_gap;
    }
};

{  //  stop minigame instead of menu

super_funcs.nmef = Scene_Map.prototype.callMenu;
Scene_Map.prototype.callMenu = function ()
{
    if (Platformer.is_active)
        Platformer.stop();
    else
        super_funcs.nmef.call(this);
};

}
