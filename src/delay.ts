
export class Delay {

    private time = 0
    private next_pop = Infinity
    private line: string[] = []

    private _action: string = ''

    set_line(line: string) {
        this.line = line.split(' ')
        this.next_pop = this.time
        return this
    }

    get action() {

        return this._action
    }

    update(delta: number) {
        this.time += delta

        if (this.line.length === 0) {
            if (this.time >= this.next_pop) {
                this.next_pop = Infinity
                this._action = 'end'
            } else if(this.next_pop < Infinity) {
                this._action = 'delay'
            } else {
                this._action = ''
            }
            return
        }

        if (this.time >= this.next_pop) {

            let res = this.line.shift()!

            let delay = parseInt(res)
            
            if (isNaN(delay)) {
                this._action = res
                this.next_pop = this.time
            } else {
                this.next_pop += delay
                this._action = 'delay'
            }
        } else {
            this._action = 'delay'
        }

    }
}