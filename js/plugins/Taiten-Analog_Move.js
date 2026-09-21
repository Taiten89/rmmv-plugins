"use strict";

/*:
 * @plugindesc Taiten's Analog_Move plugin.
 * @author Taiten - github.com/Taiten89/
 *
 * @help
 * OK to use for free even in commercial projects as long as it's acknowledged
 * in the credits or similar.
 */

globalThis.Taiten = globalThis.Taiten || {};
globalThis.super_funcs = globalThis.super_funcs || {};

{  // monkeypatch Game_Player

super_funcs.sCda = Game_Player.prototype.initMembers;
Game_Player.prototype.initMembers = function ()
{
    super_funcs.sCda.call(this);

    this.taiten_speed_x = 0.0;
    this.taiten_speed_y = 0.0;
    this.taiten_needs_drag_to_raster = false;
    this.taiten_last_nonmoving_phase_x = -1;
    this.taiten_last_nonmoving_phase_y = -1;
    this.taiten_is_in_nonmoving_phase = false;
    this.taiten_is_in_drag_phase = false;
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
    wasMoving = this.taiten_is_moving();
    return super_funcs.tPWu.call(this, wasMoving);
};

super_funcs.mGff = Game_Player.prototype.updateScroll;
Game_Player.prototype.updateScroll = function (lastScrolledX, lastScrolledY)
{
    if ($gameMap.isEventRunning())
        super_funcs.mGff.call(this, lastScrolledX, lastScrolledY);
    else
        this.taiten_scroll_to_front();
};

super_funcs.REgR = Game_Player.prototype.isMoving;
Game_Player.prototype.isMoving = function ()
{
    if ($gameMap.isEventRunning())
        return super_funcs.REgR.call(this);
    if (this.taiten_is_in_nonmoving_phase)
        return false;
    return this.taiten_is_moving();
};

Game_Player.prototype.taiten_is_moving = function ()
{
    return this.taiten_speed_x!==0.0 || this.taiten_speed_y!==0.0;
};

super_funcs.Xhix = Game_Player.prototype.update;
Game_Player.prototype.update = function (sceneActive)
{
    super_funcs.Xhix.call(this, sceneActive);

    if (this.taiten_is_in_drag_phase)
    {
        this.taiten_speed_x = 0.0;
        this.taiten_speed_y = 0.0;
        this.taiten_needs_drag_to_raster = true;
    }

    this.taiten_modify_and_apply_speed();
    this.taiten_update_nonmoving_phase();

    if (this.taiten_is_in_nonmoving_phase)  //  originally in updateMove
        this.refreshBushDepth();
};

Game_Player.prototype.moveByInput = function ()
{
    if (this.canMove())
        this.taiten_moveByInput();
};

Game_Player.prototype.taiten_moveByInput = function ()
{
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
    if (ivx === 0.0 && ivy === 0.0)
    {
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

    if (iv_length_squared > 1.0)
    {
        ivx = nivx;
        ivy = nivy;
    }

    if (Math.abs(nivx) > 0.5**0.5 + 0.1)
    {
        if (nivx > 0)
            this.setDirection(6);
        else
            this.setDirection(4);
    }
    if (Math.abs(nivy) > 0.5**0.5 + 0.1)
    {
        if (nivy > 0)
            this.setDirection(2);
        else
            this.setDirection(8);
    }

    this.taiten_accelerate_x(ivx * this.taiten_F_side());
    this.taiten_accelerate_y(ivy * this.taiten_F_side());
};

Game_Player.prototype.taiten_F_side = function ()
{
    // assuming 2m field width
    return 0.3 * 9.8 / 60 / 2.0;
};

Game_Player.prototype.taiten_accelerate_x = function (force)
{
    this.taiten_speed_x += force;
};

Game_Player.prototype.taiten_accelerate_y = function (force)
{
    this.taiten_speed_y += force;
};

Game_Player.prototype.taiten_apply_ground_resistance = function ()
{
    this.taiten_speed_x *= 1.0 - this.taiten_ground_resistance();
    this.taiten_speed_y *= 1.0 - this.taiten_ground_resistance();
};

Game_Player.prototype.taiten_ground_resistance = function ()
{
    return 0.12;
};

Game_Player.prototype.taiten_modify_and_apply_speed = function ()
{
    let next_needs_drag_to_raster = false;

    this.taiten_apply_min_speed();
    this.taiten_apply_ground_resistance();

    if (this.taiten_needs_drag_to_raster)
        this.taiten_drag_to_raster();

    const apply_speed_x_successful = this.taiten_apply_speed_x();
    if (!apply_speed_x_successful)
    {
        if ([4,6].includes(this.direction()))
            this.checkEventTriggerTouchFront(this.direction());
        this.taiten_speed_x = 0.0;
        next_needs_drag_to_raster = true;
    }

    if (this.taiten_needs_drag_to_raster)
        this.taiten_drag_to_raster();

    const apply_speed_y_successful = this.taiten_apply_speed_y();
    if (!apply_speed_y_successful)
    {
        if ([2,8].includes(this.direction()))
            this.checkEventTriggerTouchFront(this.direction());
        this.taiten_speed_y = 0.0;
        next_needs_drag_to_raster = true;
    }

    this.taiten_needs_drag_to_raster = next_needs_drag_to_raster;
};

Game_Player.prototype.taiten_can_pass = function (dir)
{
    if (dir === 2 || dir === 8)
    {
        const f = Math.floor(this._realX);
        const c = $gameMap.roundX(Math.ceil(this._realX));
        const canPass_f = this.canPass(f, this._y, dir);
        const canPass_c = this.canPass(c, this._y, dir);
        return canPass_f && canPass_c;
    }
    if (dir === 4 || dir === 6)
    {
        const f = Math.floor(this._realY);
        const c = $gameMap.roundY(Math.ceil(this._realY));
        const canPass_f = this.canPass(this._x, f, dir);
        const canPass_c = this.canPass(this._x, c, dir);
        return canPass_f && canPass_c;
    }
};

Game_Player.prototype.taiten_drag_to_raster = function ()
{
    const SPEED = 1.0 * this.taiten_F_side() / 2;  //  called twice
    if (this._realX < this._x)
        this._realX += SPEED;
    if (this._realX > this._x)
        this._realX -= SPEED;
    if (this._realY < this._y)
        this._realY += SPEED;
    if (this._realY > this._y)
        this._realY -= SPEED;
    if (Math.abs(this._realX-this._x) < SPEED)
        this._realX = this._x;
    if (Math.abs(this._realY-this._y) < SPEED)
        this._realY = this._y;

    if (this._realX === this._x && this._realY === this._y)
        this.taiten_is_in_drag_phase = false;
};

Game_Player.prototype.taiten_apply_speed_x = function ()
{
    if (this.isMoveRouteForcing())
        return true;

    if (this.taiten_speed_x > 0.0)
    {
        const gap = this._x - this._realX;
        if (this.taiten_speed_x < gap)
            this._realX += this.taiten_speed_x;
        else if (this.taiten_can_pass(6))
            this._realX += this.taiten_speed_x;
        else
            return false;
    }

    if (this.taiten_speed_x < 0.0)
    {
        const gap = this._realX - this._x;
        if (-this.taiten_speed_x < gap)
            this._realX += this.taiten_speed_x;
        else if (this.taiten_can_pass(4))
            this._realX += this.taiten_speed_x;
        else
            return false;
    }

    const wn = Math.round(this._realX);
    const p_n_gap = wn - this._realX;
    this._x = $gameMap.roundX(wn);
    this._realX = this._x - p_n_gap;

    return true;
};

Game_Player.prototype.taiten_apply_speed_y = function ()
{
    if (this.isMoveRouteForcing())
        return true;

    if (this.taiten_speed_y > 0.0)
    {
        const gap = this._y - this._realY;
        if (this.taiten_speed_y < gap)
            this._realY += this.taiten_speed_y;
        else if (this.taiten_can_pass(2))
            this._realY += this.taiten_speed_y;
        else
            return false;
    }

    if (this.taiten_speed_y < 0.0)
    {
        const gap = this._realY - this._y;
        if (-this.taiten_speed_y < gap)
            this._realY += this.taiten_speed_y;
        else if (this.taiten_can_pass(8))
            this._realY += this.taiten_speed_y;
        else
            return false;
    }

    const wn = Math.round(this._realY);
    const p_n_gap = wn - this._realY;
    this._y = $gameMap.roundY(wn);
    this._realY = this._y - p_n_gap;

    return true;
};

Game_Player.prototype.taiten_apply_min_speed = function ()
{
    if (Math.abs(this.taiten_speed_x) < this.taiten_min_speed())
        this.taiten_speed_x = 0.0;
    if (Math.abs(this.taiten_speed_y) < this.taiten_min_speed())
        this.taiten_speed_y = 0.0;
};

Game_Player.prototype.taiten_min_speed = function ()
{
    return 0.05 * this.taiten_F_side();
};

Game_Player.prototype.taiten_scroll_to_front = function ()
{
    let scroll_x = this.taiten_front_display_x() - $gameMap._displayX;
    let scroll_y = this.taiten_front_display_y() - $gameMap._displayY;

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
};

Game_Player.prototype.taiten_front_display_x = function ()
{
    const new_mid = this._realX + this.taiten_speed_x*30;
    return new_mid - $gamePlayer.centerX();
};

Game_Player.prototype.taiten_front_display_y = function ()
{
    const new_mid = this._realY + this.taiten_speed_y*30;
    return new_mid - $gamePlayer.centerY();
};

Game_Player.prototype.taiten_update_nonmoving_phase = function ()
{
    this.taiten_is_in_nonmoving_phase = false;
    const cond_x = this._x !== this.taiten_last_nonmoving_phase_x;
    const cond_y = this._y !== this.taiten_last_nonmoving_phase_y;
    if (cond_x || cond_y)
    {
        this.taiten_is_in_nonmoving_phase = true;
        this.taiten_last_nonmoving_phase_x = this._x;
        this.taiten_last_nonmoving_phase_y = this._y;
    }
};

}
{  //  monkeypatch Game_Interpreter

super_funcs.kGv1 = Game_Interpreter.prototype.setup;
Game_Interpreter.prototype.setup = function (list, eventId) {
    for (const command of list) {
        const is_move_route = command.code === 205;
        const is_player = command.parameters[0] === -1;
        if (is_move_route) {
            if (is_player)
                this.on_player_move_route(command);
        }
    }

    super_funcs.kGv1.call(this, list, eventId);
};

Game_Interpreter.prototype.on_player_move_route = function (command) {
    this.pluginCommand('drag-to-raster', []);
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
        $gamePlayer.taiten_is_in_drag_phase = true;
    super_funcs.FnGK.call(this, command, args);
};

}
