"use strict";

{  //  characters
    {  //  analog move
        globalThis.Game_Player = class extends Game_Player
        {
            initMembers ()
            {
                super.initMembers();
                this._followers._data = [];

                this.F_side = 0.3 * 9.8 / 60 / 2.0;  //  assuming 2m field width
                this.__x = this._realX;
                this.__y = this._realY;
                this.speed_x = 0.0;
                this.speed_y = 0.0;
                this.min_speed = 0.5 * this.F_side;
                this.needs_drag_to_raster = false;
                this.dbe_last_nonmoving_phase_x = -1;
                this.dbe_last_nonmoving_phase_y = -1;
                this.dbe_needs_nonmoving_phase = false;
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
                return this.speed_x!==0.0 || this.speed_y!==0.0;
            }
            locate (x, y)
            {
                this.__x = x;
                this.__y = y;
                super.locate(x, y);
            }

            update (sceneActive)
            {
                this.dbe_update_move();
                this.dbe_update_nonmoving_phase();
                this.dbe_scroll_to_front();
                super.update(sceneActive);
            }

            moveByInput ()
            {
                const direction = this.getInputDirection();
                this.setDirection(direction);
                if (direction === 2)
                    this.accelerate_y(this.F_side);
                else if (direction === 4)
                    this.accelerate_x(-this.F_side);
                else if (direction === 6)
                    this.accelerate_x(+this.F_side);
                else if (direction === 8)
                    this.accelerate_y(-this.F_side);
            }

            accelerate_x (force)
            {
                this.speed_x += force;
            }

            accelerate_y (force)
            {
                this.speed_y += force;
            }

            apply_ground_resistance ()
            {
                this.speed_x *= 1.0 - this.ground_resistance();
                this.speed_y *= 1.0 - this.ground_resistance();
            }

            ground_resistance ()
            {
                return 0.12;
            }

            dbe_update_move ()
            {
                let next_needs_drag_to_raster = false;

                this.apply_min_speed();
                this.apply_ground_resistance();

                if (this.needs_drag_to_raster)
                    this.drag_to_raster();

                const apply_speed_x_successful = this.apply_speed_x();
                if (!apply_speed_x_successful)
                {
                    this.speed_x = 0.0;
                    next_needs_drag_to_raster = true;
                }

                this.dbe_update_coordinates();

                if (this.needs_drag_to_raster)
                    this.drag_to_raster();

                const apply_speed_y_successful = this.apply_speed_y();
                if (!apply_speed_y_successful)
                {
                    this.speed_y = 0.0;
                    next_needs_drag_to_raster = true;
                }

                this.dbe_update_coordinates();

                this.needs_drag_to_raster = next_needs_drag_to_raster;
            }

            dbe_can_pass (dir)
            {
                if (dir === 2 || dir === 8)
                    return this.canPass(Math.floor(this.__x), this._y, dir) &&
                        this.canPass(Math.ceil(this.__x), this._y, dir);
                if (dir === 4 || dir === 6)
                    return this.canPass(this._x, Math.floor(this.__y), dir) &&
                        this.canPass(this._x, Math.ceil(this.__y), dir);
            }

            dbe_update_coordinates ()
            {
                this._x = Math.round(this.__x);
                this._y = Math.round(this.__y);
                this._realX = this.__x;
                this._realY = this.__y;
            }

            drag_to_raster ()
            {
                const SPEED = 1.0 * this.F_side / 2;  //  called twice
                if (this.__x < this._x)
                    this.__x += SPEED;
                if (this.__x > this._x)
                    this.__x -= SPEED;
                if (this.__y < this._y)
                    this.__y += SPEED;
                if (this.__y > this._y)
                    this.__y -= SPEED;
                if (Math.abs(this.__x-this._x) < SPEED)
                    this.__x = this._x;
                if (Math.abs(this.__y-this._y) < SPEED)
                    this.__y = this._y;
            }

            apply_speed_x ()
            {
                if (this.speed_x > 0.0)
                {
                    const gap = this._x - this.__x;
                    if (this.speed_x < gap)
                        this.__x += this.speed_x;
                    else if (this.dbe_can_pass(6))
                        this.__x += this.speed_x;
                    else
                        return false;
                }

                if (this.speed_x < 0.0)
                {
                    const gap = this.__x - this._x;
                    if (-this.speed_x < gap)
                        this.__x += this.speed_x;
                    else if (this.dbe_can_pass(4))
                        this.__x += this.speed_x;
                    else
                        return false;
                }

                return true;
            }

            apply_speed_y ()
            {
                if (this.speed_y > 0.0)
                {
                    const gap = this._y - this.__y;
                    if (this.speed_y < gap)
                        this.__y += this.speed_y;
                    else if (this.dbe_can_pass(2))
                        this.__y += this.speed_y;
                    else
                        return false;
                }

                if (this.speed_y < 0.0)
                {
                    const gap = this.__y - this._y;
                    if (-this.speed_y < gap)
                        this.__y += this.speed_y;
                    else if (this.dbe_can_pass(8))
                        this.__y += this.speed_y;
                    else
                        return false;
                }

                return true;
            }

            apply_min_speed ()
            {
                if (Math.abs(this.speed_x) < this.min_speed)
                    this.speed_x = 0.0;
                if (Math.abs(this.speed_y) < this.min_speed)
                    this.speed_y = 0.0;
            }

            dbe_scroll_to_front ()
            {
                const delta_x_pixels = (this.screenX() + this.speed_x*1300
                    - Graphics.boxWidth / 2);
                const delta_y_pixels = (this.screenY() + this.speed_y*1300
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
