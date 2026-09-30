"use strict";

if (!("globalThis" in this))
    this.globalThis = this;

/*:
 * @plugindesc Taiten's Analog_Move plugin.
 * @author Taiten - github.com/Taiten89/
 *
 * @help
 * OK to use for free even in commercial projects as long as it's acknowledged
 * in the credits or similar.
 */

globalThis.Analog_Move = {};
globalThis.super_funcs = globalThis.super_funcs || {};

Analog_Move.Player = class {

    constructor (player) {
        this._ = player;

        this.speed_x = 0.0;
        this.speed_y = 0.0;
        this.needs_drag_to_raster = false;
        this.last_nonmoving_phase_x = -1;
        this.last_nonmoving_phase_y = -1;
        this.is_in_nonmoving_phase = false;
        this.is_in_drag_phase = false;
    }

    is_moving () {
        return this.speed_x!==0.0 || this.speed_y!==0.0;
    }

    move_by_input () {
        // input vector
        let ivx = 0.0;
        let ivy = 0.0;

        const GP_THRES = 0.1;
        if (navigator.getGamepads && navigator.getGamepads())
            for (const gamepad of navigator.getGamepads())
                if (gamepad && gamepad.connected)
                {
                    const [gp_x,gp_y] = gamepad.axes;
                    if (Math.abs(gp_x) > GP_THRES)
                        ivx += gp_x;
                    if (Math.abs(gp_y) > GP_THRES)
                        ivy += gp_y;
                }

        // only take RPGMMV's input if there is none from any gamepad
        if (ivx === 0.0 && ivy === 0.0) {
            if (Input.isPressed("down"))
                ivy += 1.0;
            if (Input.isPressed("left"))
                ivx -= 1.0;
            if (Input.isPressed("right"))
                ivx += 1.0;
            if (Input.isPressed("up"))
                ivy -= 1.0;
        }

        const iv_length_squared = ivx**2 + ivy**2;
        const iv_length = iv_length_squared ** 0.5;
        const nivx = ivx / iv_length;
        const nivy = ivy / iv_length;

        if (iv_length_squared > 1.0) {
            ivx = nivx;
            ivy = nivy;
        }

        if (Math.abs(nivx) > 0.5**0.5 + 0.1) {
            if (nivx > 0)
                this._.setDirection(6);
            else
                this._.setDirection(4);
        }
        if (Math.abs(nivy) > 0.5**0.5 + 0.1) {
            if (nivy > 0 && !this._.isOnLadder())
                // ladder handling originally in increaseSteps()
                this._.setDirection(2);
            else
                this._.setDirection(8);
        }

        this.accelerate_x(ivx * this.F_side());
        this.accelerate_y(ivy * this.F_side());
    }

    update () {
        if (this.is_in_drag_phase) {
            this.speed_x = 0.0;
            this.speed_y = 0.0;
            this.needs_drag_to_raster = true;
        }

        this.modify_and_apply_speed();
        this.update_nonmoving_phase();

        if (this.is_in_nonmoving_phase)
            // originally in updateMove
            this._.refreshBushDepth();
    }

    F_side () {
        // assuming 2m field width
        return 0.3 * 9.8 / 60 / 2.0;
    }

    accelerate_x (force) {
        this.speed_x += force;
    }

    accelerate_y (force) {
        this.speed_y += force;
    }

    apply_ground_resistance () {
        this.speed_x *= 1.0 - this.ground_resistance();
        this.speed_y *= 1.0 - this.ground_resistance();
    }

    ground_resistance () {
        return 0.12;
    }

    modify_and_apply_speed () {
        let next_needs_drag_to_raster = false;

        this.apply_min_speed();
        this.apply_ground_resistance();

        if (this.needs_drag_to_raster)
            this.drag_to_raster();

        const apply_speed_x_successful = this.apply_speed_x();
        if (!apply_speed_x_successful) {
            if ([4,6].includes(this._.direction()))
                this._.checkEventTriggerTouchFront(this._.direction());
            this.speed_x = 0.0;
            next_needs_drag_to_raster = true;
        }

        if (this.needs_drag_to_raster)
            this.drag_to_raster();

        const apply_speed_y_successful = this.apply_speed_y();
        if (!apply_speed_y_successful) {
            if ([2,8].includes(this._.direction()))
                this._.checkEventTriggerTouchFront(this._.direction());
            this.speed_y = 0.0;
            next_needs_drag_to_raster = true;
        }

        this.needs_drag_to_raster = next_needs_drag_to_raster;
    }

    can_pass (dir) {
        if (dir === 2 || dir === 8) {
            const f = Math.floor(this._._realX);
            const c = $gameMap.roundX(Math.ceil(this._._realX));
            const canPass_f = this._.canPass(f, this._._y, dir);
            const canPass_c = this._.canPass(c, this._._y, dir);
            return canPass_f && canPass_c;
        }
        if (dir === 4 || dir === 6) {
            const f = Math.floor(this._._realY);
            const c = $gameMap.roundY(Math.ceil(this._._realY));
            const canPass_f = this._.canPass(this._._x, f, dir);
            const canPass_c = this._.canPass(this._._x, c, dir);
            return canPass_f && canPass_c;
        }
    }

    drag_to_raster () {
        const SPEED = 1.0 * this.F_side() / 2;  //  called twice

        if (this._._realX < this._._x)
            this._._realX += SPEED;
        if (this._._realX > this._._x)
            this._._realX -= SPEED;
        if (this._._realY < this._._y)
            this._._realY += SPEED;
        if (this._._realY > this._._y)
            this._._realY -= SPEED;

        const abs_gap_x = Math.abs(this._._realX - this._._x);
        const abs_gap_y = Math.abs(this._._realY - this._._y);
        if (abs_gap_x < SPEED)
            this._._realX = this._._x;
        if (abs_gap_y < SPEED)
            this._._realY = this._._y;

        if (this._._realX === this._._x && this._._realY === this._._y)
            this.is_in_drag_phase = false;
    }

    apply_speed_x () {
        if (this._.isMoveRouteForcing())
            return true;

        if (this.speed_x > 0.0) {
            const gap = this._._x - this._._realX;
            if (this.speed_x < gap)
                this._._realX += this.speed_x;
            else if (this.can_pass(6))
                this._._realX += this.speed_x;
            else
                return false;
        }

        if (this.speed_x < 0.0) {
            const gap = this._._realX - this._._x;
            if (-this.speed_x < gap)
                this._._realX += this.speed_x;
            else if (this.can_pass(4))
                this._._realX += this.speed_x;
            else
                return false;
        }

        const next_coord = Math.round(this._._realX);
        const p_n_gap = next_coord - this._._realX;
        this._._x = $gameMap.roundX(next_coord);
        this._._realX = this._._x - p_n_gap;

        return true;
    }

    apply_speed_y () {
        if (this._.isMoveRouteForcing())
            return true;

        if (this.speed_y > 0.0) {
            const gap = this._._y - this._._realY;
            if (this.speed_y < gap)
                this._._realY += this.speed_y;
            else if (this.can_pass(2))
                this._._realY += this.speed_y;
            else
                return false;
        }

        if (this.speed_y < 0.0) {
            const gap = this._._realY - this._._y;
            if (-this.speed_y < gap)
                this._._realY += this.speed_y;
            else if (this.can_pass(8))
                this._._realY += this.speed_y;
            else
                return false;
        }

        const next_coord = Math.round(this._._realY);
        const p_n_gap = next_coord - this._._realY;
        this._._y = $gameMap.roundY(next_coord);
        this._._realY = this._._y - p_n_gap;

        return true;
    }

    apply_min_speed () {
        if (Math.abs(this.speed_x) < this.min_speed())
            this.speed_x = 0.0;
        if (Math.abs(this.speed_y) < this.min_speed())
            this.speed_y = 0.0;
    }

    min_speed () {
        return 0.05 * this.F_side();
    }

    scroll_to_front () {
        let scroll_x = this.front_display_x() - $gameMap._displayX;
        let scroll_y = this.front_display_y() - $gameMap._displayY;

        // TODO: This causes trouble for very small maps
        if (scroll_x > 0.5 * $gameMap.width())
            scroll_x -= $gameMap.width();
        if (scroll_x < -0.5 * $gameMap.width())
            scroll_x += $gameMap.width();
        if (scroll_y > 0.5 * $gameMap.height())
            scroll_y -= $gameMap.height();
        if (scroll_y < -0.5 * $gameMap.height())
            scroll_y += $gameMap.height();

        if (scroll_x > 0.0)
            $gameMap.scrollRight(scroll_x / 20);
        if (scroll_x < 0.0)
            $gameMap.scrollLeft(-scroll_x / 20);
        if (scroll_y > 0.0)
            $gameMap.scrollDown(scroll_y / 20);
        if (scroll_y < 0.0)
            $gameMap.scrollUp(-scroll_y / 20);
    }

    front_display_x () {
        const new_mid = this._._realX + this.speed_x*30;
        return new_mid - this._.centerX();
    }

    front_display_y () {
        const new_mid = this._._realY + this.speed_y*30;
        return new_mid - this._.centerY();
    }

    update_nonmoving_phase () {
        this.is_in_nonmoving_phase = false;
        const cond_x = this._._x !== this.last_nonmoving_phase_x;
        const cond_y = this._._y !== this.last_nonmoving_phase_y;
        if (cond_x || cond_y) {
            this.is_in_nonmoving_phase = true;
            this.last_nonmoving_phase_x = this._._x;
            this.last_nonmoving_phase_y = this._._y;
        }
    }
};

{  // monkeypatch Game_Player

super_funcs.sCda = Game_Player.prototype.initMembers;
Game_Player.prototype.initMembers = function ()
{
    super_funcs.sCda.call(this);
    this.analog_move = new Analog_Move.Player(this);
};

super_funcs.HWax = Game_Player.prototype.updateMove;
Game_Player.prototype.updateMove = function ()
{
    if (this._moveRouteForcing)
        super_funcs.HWax.call(this);
};

super_funcs.tPWu = Game_Player.prototype.updateNonmoving;
Game_Player.prototype.updateNonmoving = function (wasMoving)
{
    if ($gameMap.isEventRunning())
        return super_funcs.tPWu.call(this, wasMoving);
    wasMoving = this.analog_move.is_moving();
    return super_funcs.tPWu.call(this, wasMoving);
};

super_funcs.mGff = Game_Player.prototype.updateScroll;
Game_Player.prototype.updateScroll = function (lastScrolledX, lastScrolledY)
{
    if ($gameMap.isEventRunning())
        super_funcs.mGff.call(this, lastScrolledX, lastScrolledY);
    else
        this.analog_move.scroll_to_front();
};

super_funcs.REgR = Game_Player.prototype.isMoving;
Game_Player.prototype.isMoving = function ()
{
    if ($gameMap.isEventRunning())
        return super_funcs.REgR.call(this);
    if (this.analog_move.is_in_nonmoving_phase)
        return false;
    return this.analog_move.is_moving();
};

super_funcs.Xhix = Game_Player.prototype.update;
Game_Player.prototype.update = function (sceneActive)
{
    super_funcs.Xhix.call(this, sceneActive);
    this.analog_move.update();
};

Game_Player.prototype.moveByInput = function ()
{
    if (this.canMove())
        this.analog_move.move_by_input();
};

}

Analog_Move.Interpreter = class {
    constructor (interpreter) {
        this._ = interpreter;
    }

    on_player_move_route (command) {
        this._.pluginCommand('drag-to-raster', []);
    }
};

{  //  monkeypatch Game_Interpreter

super_funcs.iSQQ = Game_Interpreter.prototype.initialize;
Game_Interpreter.prototype.initialize = function(depth) {
    super_funcs.iSQQ.call(this, depth);
    this.analog_move = new Analog_Move.Interpreter(this);
};

super_funcs.kGv1 = Game_Interpreter.prototype.setup;
Game_Interpreter.prototype.setup = function (list, eventId) {
    for (const command of list) {
        const is_move_route = command.code === 205;
        const is_player = command.parameters[0] === -1;
        if (is_move_route) {
            if (is_player)
                this.analog_move.on_player_move_route(command);
        }
    }

    super_funcs.kGv1.call(this, list, eventId);
};

super_funcs.GurM = Game_Interpreter.prototype.update;
Game_Interpreter.prototype.update = function ()
{
    if ($gamePlayer.taiten_is_in_drag_phase)
        return;
    super_funcs.GurM.call(this);
};

super_funcs.FnGK = Game_Interpreter.prototype.pluginCommand;
Game_Interpreter.prototype.pluginCommand = function (command, args)
{
    if (command === 'drag-to-raster')
        $gamePlayer.analog_move.is_in_drag_phase = true;
    super_funcs.FnGK.call(this, command, args);
};

}

{  //  monkeypatch DataManager

super_funcs.kYuS = DataManager.extractSaveContents;
DataManager.extractSaveContents = function(contents) {
    super_funcs.kYuS.call(this, contents);
    $gamePlayer.analog_move = new Analog_Move.Player($gamePlayer);
};

}
