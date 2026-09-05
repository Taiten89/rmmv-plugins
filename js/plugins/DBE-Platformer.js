"use strict";

// TODO: remove / change hacks

DBE.commands.platformer_start = function (mapId_str, x_str, y_str)
{
    DBE.platformer.is_active = true;

    DBE.platformer.orig_bgm = {...AudioManager.saveBgm()};
    DBE.platformer.orig_bgs = {...AudioManager.saveBgs()};
    AudioManager.stopBgm();
    AudioManager.stopBgs();

    DBE.platformer.store_orig();
    const Extended_Game_Player = DBE.platformer.extend_Character(Game_Player);
    $gamePlayer = new Extended_Game_Player();

    const mapId = Number(mapId_str);
    const x = Number(x_str);
    const y = Number(y_str);
    $gamePlayer.reserveTransfer(mapId, x, y, 6, 0);
};

DBE.commands.platformer_stop = function ()
{
    DBE.platformer.is_active = false;

    AudioManager.playBgm(DBE.platformer.orig_bgm, DBE.platformer.orig_bgm.pos);
    AudioManager.playBgs(DBE.platformer.orig_bgs);
    DBE.platformer.orig_bgm = {};
    DBE.platformer.orig_bgs = {};

    const mapId = DBE.platformer.orig_gameMap.mapId();
    const x = 0;
    const y = 0;
    $gamePlayer.reserveTransfer(mapId, x, y, 2, 0);
};

DBE.platformer =
{
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
        jump_max: Math.round(0.12 * 60),
    },
};

DBE.platformer.store_orig = function ()
{
    DBE.platformer.orig_dataMap = $dataMap;
    DBE.platformer.orig_gameMap = $gameMap;
    DBE.platformer.orig_player = $gamePlayer;
};

DBE.platformer.unstore_orig = function ()
{
    $dataMap = DBE.platformer.orig_dataMap;
    DBE.platformer.orig_dataMap = null;
    $gameMap = DBE.platformer.orig_gameMap;
    DBE.platformer.orig_gameMap = null;
    $gamePlayer = DBE.platformer.orig_player;
    DBE.platformer.orig_player = null;
};

DBE.platformer.extend_Character = (Base) =>
class extends Base
{
    initMembers ()
    {
        super.initMembers();

        this.is_initted = false;
        this.jump_remaining = 0;
        this.is_jump_triggered = false;
        this.is_on_ground = false;

        for (const k in DBE.platformer.defaults)
            this[k] = DBE.platformer.defaults[k];
    }

    performTransfer ()
    {
        if (!this.is_initted)
        {
            $gameMap = new Game_Map();
            super.performTransfer();
            this.is_initted = true;
            return;
        }

        if (!DBE.platformer.is_active)
        {
            DBE.platformer.unstore_orig();
            super.performTransfer();
            return;
        }
    }

    hasWalkAnime ()
    {
        if (!this.is_on_ground)
            return false;
        return super.hasWalkAnime();
    }
    locate (x, y)
    {
        super.locate(x, y);
        this.update_is_on_ground();
    }

    setDirection (dir)
    {
        if (dir === 2 || dir === 8)
            return;
        super.setDirection(dir);
    }

    taiten_moveByInput ()
    {
        if (Input.isTriggered(DBE.platformer.JUMP_INPUT))
            this.is_jump_triggered = true;
        if (!Input.isPressed(DBE.platformer.JUMP_INPUT))
        {
            this.is_jump_triggered = false;
            this.jump_remaining = 0;
        }

        if (this.canMove())
        {
            this.dbe_move_by_direction_input();

            if (Input.isPressed(DBE.platformer.JUMP_INPUT))
                this.dbe_handle_jump_pressed();
        }
    }

    taiten_apply_ground_resistance () {}

    taiten_apply_speed_x ()
    {
        const super_result = super.taiten_apply_speed_x();
        if (!super_result)
        {
            this.taiten_speed_x = 0.0;
            this._realX = this._x;
        }
        // hack: discard super result;
        // drag-to-raster won't be provoked
        return true;
    }

    taiten_apply_speed_y ()
    {
        const super_result = super.taiten_apply_speed_y();
        if (!super_result)
        {
            this.taiten_speed_y = 0.0;
            this._realY = this._y;
        }
        // hack: discard super result;
        // drag-to-raster won't be provoked
        return true;
    }

    dbe_move_by_direction_input ()
    {
        const direction = this.getInputDirection();
        this.setDirection(direction);
        if (this.is_on_ground)
        {
            if (direction === 4)
                this.taiten_accelerate_x(-this.F_side);
            else if (direction === 6)
                this.taiten_accelerate_x(+this.F_side);
            else
                this.brake_x();
        }
        else
        {
            if (direction === 4)
                this.taiten_accelerate_x(-this.F_side / 4);
            else if (direction === 6)
                this.taiten_accelerate_x(+this.F_side / 4);
        }
    }

    dbe_handle_jump_pressed ()
    {
        if (this.is_jump_triggered && this.is_on_ground)
        {
            this.jump_remaining = this.jump_max;
            this.is_jump_triggered = false;
        }
    }

    brake_x ()
    {
        this.taiten_speed_x *= 0.75;
    }

    apply_wind_resistance ()
    {
        this.taiten_speed_x *= 1.0 - 1.0 / 64.0;
        this.taiten_speed_y *= 1.0 - 1.0 / 64.0;
    }

    apply_ground_resistance ()
    {
        this.taiten_speed_x *= 1.0 - 1.0 / 32.0;
    }

    update_is_on_ground ()
    {
        const can_pass = this.canPass(this._x, this._y, 2);
        const has_gap = this._realY !== this._y;
        this.is_on_ground = !can_pass && !has_gap;
    }

    taiten_modify_and_apply_speed ()
    {
        this.taiten_accelerate_y(this.G);

        if (this.jump_remaining)
        {
            this.taiten_accelerate_y(-this.F_jump);
            this.jump_remaining--;
        }

        this.apply_wind_resistance();
        if (this.is_on_ground)
            this.apply_ground_resistance();

        super.taiten_modify_and_apply_speed();

        this.update_is_on_ground();
    }
};

{  //  stop minigame instead of menu
    const super_callMenu = Scene_Map.prototype.callMenu;
    Scene_Map.prototype.callMenu = function ()
    {
        if (DBE.platformer.is_active)
            DBE.commands.platformer_stop();
        else
            super_callMenu.call(this);
    };
}
