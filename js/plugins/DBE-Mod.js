"use strict";

{  //  characters
    {  //  analog move
        globalThis.Game_Player = class extends Game_Player
        {
            initMembers ()
            {
                super.initMembers();
                this._followers._data = [];

                this.F_side = 0.2 * 9.8 / 60 / 2;  //  assuming 2m field height
                this.__x = this._realX;
                this.__y = this._realY;
                this.speed_x = 0.0;
                this.speed_y = 0.0;
            }

            moveByInput () {}
            updateMove () {}
            updateScroll (lastScrolledX, lastScrolledY) {}
            isMoving ()
            {
                return Math.abs(this.speed_x)>0.001 || Math.abs(this.speed_y)>0.001;
            }
            locate (x, y)
            {
                this.__x = x;
                this.__y = y;
                super.locate(x, y);
            }

            update (sceneActive)
            {
                if (this.canMove())
                    this.dbe_move_by_input();
                this.dbe_update_move();
                if (this.canMove())
                    this.dbe_scroll_to_front();
                super.update(sceneActive);
            }

            dbe_move_by_input ()
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
                else
                    this.brake();
            }

            accelerate_x (force)
            {
                this.speed_x += force;
            }

            accelerate_y (force)
            {
                this.speed_y += force;
            }

            brake ()
            {
                this.speed_x *= 1.0 - 1.0 / 4.0;
                this.speed_y *= 1.0 - 1.0 / 4.0;
            }

            apply_ground_resistance ()
            {
                this.speed_x *= 1.0 - 1.0 / 16.0;
                this.speed_y *= 1.0 - 1.0 / 16.0;
            }

            dbe_update_move ()
            {
                this.apply_ground_resistance();

                if (this.speed_x > 0.0)
                {
                    const gap = this._x - this.__x;
                    if (this.speed_x < gap)
                        this.__x += this.speed_x;
                    else if (this.canPass(this._x, this._y, 6))
                        this.__x += this.speed_x;
                    else
                    {
                        this.__x = this._x;
                        this.speed_x = 0.0;
                    }
                }

                if (this.speed_x < 0.0)
                {
                    const gap = this.__x - this._x;
                    if (-this.speed_x < gap)
                        this.__x += this.speed_x;
                    else if (this.canPass(this._x, this._y, 4))
                        this.__x += this.speed_x;
                    else
                    {
                        this.__x = this._x;
                        this.speed_x = 0.0;
                    }
                }

                this.dbe_update_coordinates();

                if (this.speed_y > 0.0)
                {
                    const gap = this._y - this.__y;
                    if (this.speed_y < gap)
                        this.__y += this.speed_y;
                    else if (this.canPass(this._x, this._y, 2))
                        this.__y += this.speed_y;
                    else
                    {
                        this.__y = this._y;
                        this.speed_y = 0.0;
                    }
                }

                if (this.speed_y < 0.0)
                {
                    const gap = this.__y - this._y;
                    if (-this.speed_y < gap)
                        this.__y += this.speed_y;
                    else if (this.canPass(this._x, this._y, 8))
                        this.__y += this.speed_y;
                    else
                    {
                        this.__y = this._y;
                        this.speed_y = 0.0;
                    }
                }

                this.dbe_update_coordinates();
            }

            dbe_update_coordinates ()
            {
                this._x = Math.round(this.__x);
                this._y = Math.round(this.__y);
                this._realX = this.__x;
                this._realY = this.__y;
            }

            dbe_scroll_to_front ()
            {
                const delta_x_pixels = (this.screenX() + this.speed_x*500
                    - Graphics.boxWidth / 2);
                const delta_y_pixels = (this.screenY() + this.speed_y*500
                    - Graphics.boxHeight / 2);
                const delta_x = delta_x_pixels / $gameMap.tileWidth();
                const delta_y = delta_y_pixels / $gameMap.tileHeight();
                $gameMap._displayX += delta_x / 8;
                $gameMap._displayY += delta_y / 8;
            }
        };
    }
}
