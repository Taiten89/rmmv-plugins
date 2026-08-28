"use strict";

DBE.commands.platformer_start = function (mapId_str, x_str, y_str)
{
    DBE.platformer.is_active = true;

    DBE.platformer.init();

    const mapId = Number(mapId_str);
    const x = Number(x_str);
    const y = Number(y_str);
    $gamePlayer.reserveTransfer(mapId, x, y, 6, 0);
};

DBE.commands.platformer_stop = function ()
{
    DBE.platformer.is_active = false;

    const mapId = DBE.platformer.orig_gameMap.mapId();
    const x = 0;
    const y = 0;
    $gamePlayer.reserveTransfer(mapId, x, y, 2, 0);
};

DBE.platformer =
{
    JUMP_INPUT: 'up',
    is_active: false,
    orig_dataMap: null,
    orig_gameMap: null,
    orig_player: null,

    defaults:
    {
        G: 9.8 / 60 / 2 / 4,  // assuming 2m field height; /4 because slower is more fun
        F_side: 0.3 * 9.8 / 60 / 2,
        F_jump: 0.075,
        jump_max: Math.round(0.12 * 60),
    },
};

DBE.platformer.init = function ()
{
    DBE.platformer.orig_dataMap = $dataMap;
    DBE.platformer.orig_gameMap = $gameMap;
    DBE.platformer.orig_player = $gamePlayer;
    const Extended_Game_Player = DBE.platformer.extend_Character(Game_Player);
    $gamePlayer = new Extended_Game_Player();
};

DBE.platformer.uninit = function ()
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

        this.speed_x = 0.0;
        this.speed_y = 0.0;
        this.jump_remaining = 0;
        this.is_jump_triggered = false;

        for (const k in DBE.platformer.defaults)
            this[k] = DBE.platformer.defaults[k];
    }

    performTransfer ()
    {
        if (DBE.platformer.is_active)
            $gameMap = new Game_Map();
        else
            DBE.platformer.uninit();
        super.performTransfer();
    }

    moveByInput () {}
    updateMove () {}
    updateAnalogMove () {}  //  SAN_AnalogMove

    update ()
    {
        this.dbe_move_by_input();
        this.dbe_update_move();
        super.update();
    }

    setDirection (dir)
    {
        if (dir === 2 || dir === 8)
            return;
        super.setDirection(dir);
    }

    isMoving ()
    {
        return false;
    }

    dbe_move_by_input ()
    {
        if (Input.isTriggered(DBE.platformer.JUMP_INPUT))
            this.is_jump_triggered = true;
        if (!Input.isPressed(DBE.platformer.JUMP_INPUT))
        {
            this.is_jump_triggered = false;
            this.jump_remaining = 0;
        }

        if (/*!this.isMoving() &&*/ this.canMove())
        {
            this.dbe_move_by_direction_input();

            if (Input.isPressed(DBE.platformer.JUMP_INPUT))
                this.dbe_handle_jump_pressed();
        }
    }

    dbe_move_by_direction_input ()
    {
        const direction = this.getInputDirection();
        if (this.is_on_ground())
        {
            if (direction === 4)
                this.accelerate_x(-this.F_side);
            else if (direction === 6)
                this.accelerate_x(+this.F_side);
            else
                this.brake_x();
        }
        else
        {
            if (direction === 4)
                this.accelerate_x(-this.F_side / 4);
            else if (direction === 6)
                this.accelerate_x(+this.F_side / 4);
        }
    }

    dbe_handle_jump_pressed ()
    {
        if (this.is_jump_triggered && this.is_on_ground())
        {
            this.jump_remaining = this.jump_max;
            this.is_jump_triggered = false;
        }
    }

    accelerate_x (force)
    {
        this.speed_x += force;
    }

    accelerate_y (force)
    {
        this.speed_y += force;
    }

    brake_x ()
    {
        const orig_speed_x = this.speed_x;
        const force = -1.0 / 4 * orig_speed_x;
        this.accelerate_x(force);

        if (orig_speed_x > 0.0)
        {
            if (this.speed_x < 0.0)
                this.speed_x = 0.0;
        }
        else if (orig_speed_x < 0.0)
        {
            if (this.speed_x > 0.0)
                this.speed_x = 0.0;
        }
    }

    is_on_ground ()
    {
        const can_pass = this.canPass(this._x, this._y, 2);
        const has_gap = this._realY !== this._y;
        return !can_pass && !has_gap;
    }

    hasStepAnime ()
    {
        return Math.abs(this.speed_x) > 0.0;
    }

    dbe_update_move()
    {
        this.accelerate_y(this.G);

        if (this.jump_remaining)
        {
            this.accelerate_y(-this.F_jump);
            this.jump_remaining--;
        }

        if (this.speed_x > 0.0)
        {
            if (this.canPass(this._x, this._y, 6))
                this._realX += this.speed_x;
            else if (this.speed_x < this._x - this._realX)
                this._realX += this.speed_x;
            else
            {
                this._realX = this._x;
                this.speed_x = 0.0;
            }
        }

        if (this.speed_x < 0.0)
        {
            if (this.speed_x > this._x - this._realX)
                this._realX += this.speed_x;
            else if (this.canPass(this._x, this._y, 4))
                this._realX += this.speed_x;
            else
            {
                this._realX = this._x;
                this.speed_x = 0.0;
            }
        }

        if (this.speed_y > 0.0)
        {
            if (this.speed_y < this._y - this._realY)
                this._realY += this.speed_y;
            else if (this.canPass(this._x, this._y, 2))
                this._realY += this.speed_y;
            else
            {
                this._realY = this._y;
                this.speed_y = 0.0;
            }
        }

        if (this.speed_y < 0.0)
        {
            if (this.speed_y > this._y - this._realY)
                this._realY += this.speed_y;
            else if (this.canPass(this._x, this._y, 8))
                this._realY += this.speed_y;
            else
            {
                this._realY = this._y;
                this.speed_y = 0.0;
            }
        }

        this._x = Math.round(this._realX);
        this._y = Math.round(this._realY);
    }
};
