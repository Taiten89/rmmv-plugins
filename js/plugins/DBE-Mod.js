"use strict";

{  //  characters
    {  //  analog move
        globalThis.Game_Player = class extends Game_Player
        {
            initMembers ()
            {
                super.initMembers();
                this._followers._data = [];

                this.dbe_speed_x = 0.0;
                this.dbe_speed_y = 0.0;
                this.dbe_needs_drag_to_raster = false;
                this.dbe_last_nonmoving_phase_x = -1;
                this.dbe_last_nonmoving_phase_y = -1;
                this.dbe_is_in_nonmoving_phase = false;
                this.dbe_is_in_drag_phase = false;
            }

            forceMoveRoute (moveRoute)
            {
                this.dbe_speed_x = 0.0;
                this.dbe_speed_y = 0.0;
                this._realX = this._x;
                this._realY = this._y;
                super.forceMoveRoute(moveRoute);
            }
            updateMove ()
            {
                if (this._moveRouteForcing)
                    super.updateMove();
            }
            updateNonmoving (wasMoving)
            {
                if ($gameMap.isEventRunning())
                    return super.updateNonmoving(wasMoving);
                wasMoving = this.dbe_is_moving();
                return super.updateNonmoving(wasMoving);
            }
            updateScroll (lastScrolledX, lastScrolledY)
            {
                if ($gameMap.isEventRunning())
                    super.updateScroll(lastScrolledX, lastScrolledY);
                else
                    this.dbe_scroll_to_front();
            }
            isMoving ()
            {
                if ($gameMap.isEventRunning())
                    return super.isMoving();
                if (this.dbe_is_in_nonmoving_phase)
                    return false;
                return this.dbe_is_moving();
            }
            dbe_is_moving ()
            {
                return this.dbe_speed_x!==0.0 || this.dbe_speed_y!==0.0;
            }

            update (sceneActive)
            {
                super.update(sceneActive);

                if (this.dbe_is_in_drag_phase)
                {
                    this.dbe_speed_x = 0.0;
                    this.dbe_speed_y = 0.0;
                    this.dbe_needs_drag_to_raster = true;
                }

                this.dbe_modify_and_apply_speed();
                this.dbe_update_nonmoving_phase();

                if (this.dbe_is_in_nonmoving_phase)  //  originally in updateMove
                    this.refreshBushDepth();
            }

            moveByInput ()
            {
                if (this.canMove())
                    this.dbe_moveByInput();
            }
            dbe_moveByInput ()
            {
                const direction = this.getInputDirection();
                this.setDirection(direction);
                if (direction === 2)
                    this.dbe_accelerate_y(this.dbe_F_side());
                else if (direction === 4)
                    this.dbe_accelerate_x(-this.dbe_F_side());
                else if (direction === 6)
                    this.dbe_accelerate_x(+this.dbe_F_side());
                else if (direction === 8)
                    this.dbe_accelerate_y(-this.dbe_F_side());
            }

            dbe_F_side ()
            {
                // assuming 2m field width
                return 0.3 * 9.8 / 60 / 2.0;
            }

            dbe_accelerate_x (force)
            {
                this.dbe_speed_x += force;
            }

            dbe_accelerate_y (force)
            {
                this.dbe_speed_y += force;
            }

            dbe_apply_ground_resistance ()
            {
                this.dbe_speed_x *= 1.0 - this.dbe_ground_resistance();
                this.dbe_speed_y *= 1.0 - this.dbe_ground_resistance();
            }

            dbe_ground_resistance ()
            {
                return 0.12;
            }

            dbe_modify_and_apply_speed ()
            {
                let next_needs_drag_to_raster = false;

                this.dbe_apply_min_speed();
                this.dbe_apply_ground_resistance();

                if (this.dbe_needs_drag_to_raster)
                    this.dbe_drag_to_raster();

                const apply_speed_x_successful = this.dbe_apply_speed_x();
                if (!apply_speed_x_successful)
                {
                    if ([4,6].includes(this.direction()))
                        this.checkEventTriggerTouchFront(this.direction());
                    this.dbe_speed_x = 0.0;
                    next_needs_drag_to_raster = true;
                }

                if (this.dbe_needs_drag_to_raster)
                    this.dbe_drag_to_raster();

                const apply_speed_y_successful = this.dbe_apply_speed_y();
                if (!apply_speed_y_successful)
                {
                    if ([2,8].includes(this.direction()))
                        this.checkEventTriggerTouchFront(this.direction());
                    this.dbe_speed_y = 0.0;
                    next_needs_drag_to_raster = true;
                }

                this.dbe_needs_drag_to_raster = next_needs_drag_to_raster;
            }

            dbe_can_pass (dir)
            {
                if (dir === 2 || dir === 8)
                {
                    const f = Math.floor(this._realX);
                    const c = $gameMap.roundX(Math.ceil(this._realX));
                    return this.canPass(f, this._y, dir) &&
                           this.canPass(c, this._y, dir);
                }
                if (dir === 4 || dir === 6)
                {
                    const f = Math.floor(this._realY);
                    const c = $gameMap.roundY(Math.ceil(this._realY));
                    return this.canPass(this._x, f, dir) &&
                           this.canPass(this._x, c, dir);
                }
            }

            dbe_drag_to_raster ()
            {
                const SPEED = 1.0 * this.dbe_F_side() / 2;  //  called twice
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
                    this.dbe_is_in_drag_phase = false;
            }

            dbe_apply_speed_x ()
            {
                if (this.isMoveRouteForcing())
                    return true;

                if (this.dbe_speed_x > 0.0)
                {
                    const gap = this._x - this._realX;
                    if (this.dbe_speed_x < gap)
                        this._realX += this.dbe_speed_x;
                    else if (this.dbe_can_pass(6))
                        this._realX += this.dbe_speed_x;
                    else
                        return false;
                }

                if (this.dbe_speed_x < 0.0)
                {
                    const gap = this._realX - this._x;
                    if (-this.dbe_speed_x < gap)
                        this._realX += this.dbe_speed_x;
                    else if (this.dbe_can_pass(4))
                        this._realX += this.dbe_speed_x;
                    else
                        return false;
                }

                const wn = Math.round(this._realX);
                const p_n_gap = wn - this._realX;
                this._x = $gameMap.roundX(wn);
                this._realX = this._x - p_n_gap;

                return true;
            }

            dbe_apply_speed_y ()
            {
                if (this.isMoveRouteForcing())
                    return true;

                if (this.dbe_speed_y > 0.0)
                {
                    const gap = this._y - this._realY;
                    if (this.dbe_speed_y < gap)
                        this._realY += this.dbe_speed_y;
                    else if (this.dbe_can_pass(2))
                        this._realY += this.dbe_speed_y;
                    else
                        return false;
                }

                if (this.dbe_speed_y < 0.0)
                {
                    const gap = this._realY - this._y;
                    if (-this.dbe_speed_y < gap)
                        this._realY += this.dbe_speed_y;
                    else if (this.dbe_can_pass(8))
                        this._realY += this.dbe_speed_y;
                    else
                        return false;
                }

                const wn = Math.round(this._realY);
                const p_n_gap = wn - this._realY;
                this._y = $gameMap.roundY(wn);
                this._realY = this._y - p_n_gap;

                return true;
            }

            dbe_apply_min_speed ()
            {
                if (Math.abs(this.dbe_speed_x) < this.dbe_min_speed())
                    this.dbe_speed_x = 0.0;
                if (Math.abs(this.dbe_speed_y) < this.dbe_min_speed())
                    this.dbe_speed_y = 0.0;
            }

            dbe_min_speed ()
            {
                return 0.5 * this.dbe_F_side();
            }

            dbe_scroll_to_front ()
            {
                let scroll_x = this.dbe_front_display_x() - $gameMap._displayX;
                let scroll_y = this.dbe_front_display_y() - $gameMap._displayY;

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
            dbe_front_display_x ()
            {
                const new_mid = this._realX + this.dbe_speed_x*30;
                return new_mid - $gamePlayer.centerX();
            }
            dbe_front_display_y ()
            {
                const new_mid = this._realY + this.dbe_speed_y*30;
                return new_mid - $gamePlayer.centerY();
            }

            dbe_update_nonmoving_phase ()
            {
                this.dbe_is_in_nonmoving_phase = false;
                const cond_x = this._x !== this.dbe_last_nonmoving_phase_x;
                const cond_y = this._y !== this.dbe_last_nonmoving_phase_y;
                if (cond_x || cond_y)
                {
                    this.dbe_is_in_nonmoving_phase = true;
                    this.dbe_last_nonmoving_phase_x = this._x;
                    this.dbe_last_nonmoving_phase_y = this._y;
                }
            }
        };

        globalThis.Game_Interpreter = class extends Game_Interpreter
        {
            update ()
            {
                if ($gamePlayer.dbe_is_in_drag_phase)
                    return;
                super.update();
            }
        };

        DBE.commands.drag_to_raster = function ()
        {
            $gamePlayer.dbe_is_in_drag_phase = true;
        };
    }  //  analog move
}
