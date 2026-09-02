"use strict";

{  //  characters
    {  //  analog move
        globalThis.Game_Player = class extends Game_Player
        {
            initMembers ()
            {
                super.initMembers();
                this._followers._data = [];

                this.dbe_F_side = 0.3 * 9.8 / 60 / 2.0;  //  assuming 2m field width
                this.dbe_x = this._realX;
                this.dbe_y = this._realY;
                this.dbe_speed_x = 0.0;
                this.dbe_speed_y = 0.0;
                this.dbe_min_speed = 0.5 * this.dbe_F_side;
                this.dbe_needs_drag_to_raster = false;
                this.dbe_last_nonmoving_phase_x = -1;
                this.dbe_last_nonmoving_phase_y = -1;
                this.dbe_is_in_nonmoving_phase = false;
            }

            updateMove () {}
            updateScroll (lastScrolledX, lastScrolledY) {}
            isMoving ()
            {
                if ($gameMap.isEventRunning())
                    return super.isMoving();
                if (this.dbe_is_in_nonmoving_phase)
                    return false;
                return this.dbe_speed_x!==0.0 || this.dbe_speed_y!==0.0;
            }
            locate (x, y)
            {
                this.dbe_x = x;
                this.dbe_y = y;
                super.locate(x, y);
            }

            update (sceneActive)
            {
                super.update(sceneActive);
                this.dbe_modify_and_apply_speed();
                this.dbe_update_coordinates();
                this.dbe_update_nonmoving_phase();
                this.dbe_scroll_to_front();
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
                    this.dbe_accelerate_y(this.dbe_F_side);
                else if (direction === 4)
                    this.dbe_accelerate_x(-this.dbe_F_side);
                else if (direction === 6)
                    this.dbe_accelerate_x(+this.dbe_F_side);
                else if (direction === 8)
                    this.dbe_accelerate_y(-this.dbe_F_side);
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
                    this.dbe_speed_x = 0.0;
                    next_needs_drag_to_raster = true;
                }

                this.dbe_update_coordinates();

                if (this.dbe_needs_drag_to_raster)
                    this.dbe_drag_to_raster();

                const apply_speed_y_successful = this.dbe_apply_speed_y();
                if (!apply_speed_y_successful)
                {
                    this.dbe_speed_y = 0.0;
                    next_needs_drag_to_raster = true;
                }

                this.dbe_update_coordinates();

                this.dbe_needs_drag_to_raster = next_needs_drag_to_raster;
            }

            dbe_can_pass (dir)
            {
                if (dir === 2 || dir === 8)
                    return this.canPass(Math.floor(this.dbe_x), this._y, dir) &&
                        this.canPass(Math.ceil(this.dbe_x), this._y, dir);
                if (dir === 4 || dir === 6)
                    return this.canPass(this._x, Math.floor(this.dbe_y), dir) &&
                        this.canPass(this._x, Math.ceil(this.dbe_y), dir);
            }

            dbe_update_coordinates ()
            {
                this._x = Math.round(this.dbe_x);
                this._y = Math.round(this.dbe_y);
                this._realX = this.dbe_x;
                this._realY = this.dbe_y;
            }

            dbe_drag_to_raster ()
            {
                const SPEED = 1.0 * this.dbe_F_side / 2;  //  called twice
                if (this.dbe_x < this._x)
                    this.dbe_x += SPEED;
                if (this.dbe_x > this._x)
                    this.dbe_x -= SPEED;
                if (this.dbe_y < this._y)
                    this.dbe_y += SPEED;
                if (this.dbe_y > this._y)
                    this.dbe_y -= SPEED;
                if (Math.abs(this.dbe_x-this._x) < SPEED)
                    this.dbe_x = this._x;
                if (Math.abs(this.dbe_y-this._y) < SPEED)
                    this.dbe_y = this._y;
            }

            dbe_apply_speed_x ()
            {
                if (this.dbe_speed_x > 0.0)
                {
                    const gap = this._x - this.dbe_x;
                    if (this.dbe_speed_x < gap)
                        this.dbe_x += this.dbe_speed_x;
                    else if (this.dbe_can_pass(6))
                        this.dbe_x += this.dbe_speed_x;
                    else
                        return false;
                }

                if (this.dbe_speed_x < 0.0)
                {
                    const gap = this.dbe_x - this._x;
                    if (-this.dbe_speed_x < gap)
                        this.dbe_x += this.dbe_speed_x;
                    else if (this.dbe_can_pass(4))
                        this.dbe_x += this.dbe_speed_x;
                    else
                        return false;
                }

                return true;
            }

            dbe_apply_speed_y ()
            {
                if (this.dbe_speed_y > 0.0)
                {
                    const gap = this._y - this.dbe_y;
                    if (this.dbe_speed_y < gap)
                        this.dbe_y += this.dbe_speed_y;
                    else if (this.dbe_can_pass(2))
                        this.dbe_y += this.dbe_speed_y;
                    else
                        return false;
                }

                if (this.dbe_speed_y < 0.0)
                {
                    const gap = this.dbe_y - this._y;
                    if (-this.dbe_speed_y < gap)
                        this.dbe_y += this.dbe_speed_y;
                    else if (this.dbe_can_pass(8))
                        this.dbe_y += this.dbe_speed_y;
                    else
                        return false;
                }

                return true;
            }

            dbe_apply_min_speed ()
            {
                if (Math.abs(this.dbe_speed_x) < this.dbe_min_speed)
                    this.dbe_speed_x = 0.0;
                if (Math.abs(this.dbe_speed_y) < this.dbe_min_speed)
                    this.dbe_speed_y = 0.0;
            }

            dbe_scroll_to_front ()
            {
                const delta_x_pixels = (this.screenX() + this.dbe_speed_x*1300
                    - Graphics.boxWidth / 2);
                const delta_y_pixels = (this.screenY() + this.dbe_speed_y*1300
                    - Graphics.boxHeight / 2);
                const delta_x = delta_x_pixels / $gameMap.tileWidth();
                const delta_y = delta_y_pixels / $gameMap.tileHeight();
                $gameMap._displayX += delta_x / 16;
                $gameMap._displayY += delta_y / 16;
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
    }
}
