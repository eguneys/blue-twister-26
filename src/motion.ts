enum TokenType {
    EOF = 'EOF',
    NEW_LINE = 'NEW_LINE',
    WORD = 'WORD',
    MOTION_DEF = 'MOTION_DEF',
    EQUALS = 'MOTION_EQUALS',
    SPRING= 'SPRING',
    DELTA = 'DELTA',
    NUMBER = 'NUMBER'
}

interface Token {
    type: TokenType
    value: string
}

class LexerError extends Error {}
class ParserError extends Error {}

export class Lexer {
    private text: string
    private pos: number
    private current_char?: string

    constructor(text: string) {
        this.text = text
        this.pos = 0
        this.current_char = this.text[this.pos]
    }

    private advance() {
        this.pos++;
        this.current_char = this.text[this.pos]
    }

    private skip_whitespace() {
        while (this.current_char !== undefined && /\s/.test(this.current_char)) {
            this.advance()
        }
    }


    private is_float(char: string): boolean {
        return /[0-9\.]/.test(char)
    }

    private float() {
        let result = ''
        while (this.current_char !== undefined && this.is_float(this.current_char)) {
            result += this.current_char
            this.advance()
        }
        return result
    }



    private is_alpha_num(char: string): boolean {
        return /[a-zA-Z0-9_]/.test(char)
    }

    private word() {
        let result = ''
        while (this.current_char !== undefined && this.is_alpha_num(this.current_char)) {
            result += this.current_char
            this.advance()
        }
        return result
    }

    public get_next_token(): Token {
        while (this.current_char !== undefined) {
            this.skip_whitespace()

            let current_char = this.current_char
            if (current_char === '-' || current_char === '+') {
                this.advance()
                return { type: TokenType.DELTA, value: current_char }
            }

            if (current_char === '=') {
                this.advance()
                return { type: TokenType.EQUALS, value: '=' }
            }

            if (current_char === '~') {
                this.advance()
                return { type: TokenType.SPRING, value: '~' }
            }

            if (current_char === 'M') {
                this.advance()
                this.advance()
                return { type: TokenType.MOTION_DEF, value: 'M_' }
            }

            const float_str = this.float()

            if (float_str !== '') {
                return { type: TokenType.NUMBER, value: float_str }
            }

            const word_str = this.word()
            if (word_str !== '') {
                return { type: TokenType.WORD, value: word_str }
            }



            if (this.current_char === undefined) {
                break
            }
            throw new LexerError(`Unexpected token ${this.current_char}`)
        }
        return { type: TokenType.EOF, value: '' }
    }
}


export class Parser {
    private lexer: Lexer
    private current_token: Token
    private lookahead_token: Token

    constructor(lexer: Lexer) {
        this.lexer = lexer
        this.current_token = this.lexer.get_next_token()
        this.lookahead_token = this.lexer.get_next_token()
    }

    private error(expected_type?: TokenType) {

        if (expected_type) {
            throw new ParserError(`Expected ${expected_type} but got ${this.current_token.type} ('${this.current_token.value}')`)
        } else {
            throw new ParserError(`Unexpected token ${this.current_token.type} ('${this.current_token.value}')`)
        }
    }

    private advance_tokens() {
        this.current_token = this.lookahead_token
        this.lookahead_token = this.lexer.get_next_token()
    }


    private eat(token_type: TokenType) {
        if (this.current_token.type === token_type) {
            this.advance_tokens()
        } else {
            this.error(token_type)
        }
    }

    private word() {
        const token = this.current_token
        this.eat(TokenType.WORD)
        return token.value
    }

    private delta() {

        let delta_token = this.current_token
        this.eat(TokenType.DELTA)

        let token = this.current_token
        this.eat(TokenType.NUMBER)
        let value = parseFloat(token.value)

        let res = delta_token.value === '-' ? -value : value

        return res
    }

    private motion(): Motion {
        let param = this.word()

        this.eat(TokenType.SPRING)
        let delta = this.delta()

        let res: MotionSpring = {
            motion: 'spring',
            param,
            delta
        }

        return res
    }

    parse_definition(): MotionDefinition {

        let current_token = this.current_token
        if (current_token.type === TokenType.MOTION_DEF) {
            this.eat(TokenType.MOTION_DEF)
            let name = this.word()

            this.eat(TokenType.EQUALS)

            let motions = []
            while (this.current_token.type !== TokenType.NEW_LINE && this.current_token.type !== TokenType.EOF) {
                motions.push(this.motion())
            }

            let res: MoveDefinition = {
                type: 'motion',
                name,
                motions
            }
            return res
        }

        throw this.error()
    }

}

/*
S_D= Y~+50 . S/ W=*0.5 H=*.8 _L _D _R

M_P= S/3 _U _R _L _D


M_P= X~-50
*/

export type Param = string

export type MotionType = 'delay' | 'spring' | 'spawn'

export type Motion = { motion: MotionType }

export type MotionDelay = {
    motion: 'delay',
    delay: number
}

export type MotionSpring = {
    motion: 'spring',
    param: Param
    delta: number
}

export type MotionSpawn = {
    motion: 'spawn'
    iteration: number
    spawns: string[]
    params: Param[]
}

export const is_motion_spring = (_: Motion): _ is MotionSpring => {
    return _.motion === 'spring'
}

export const is_motion_delay = (_: Motion): _ is MotionDelay => {
    return _.motion === 'delay'
}

export type MotionDefinitionType = 'spawn' | 'motion'

export type MotionDefinition = { type: MotionDefinitionType }

export type SpawnDefinition = {
    type: 'spawn'
    name: string
    motions: Motion[]
}

export type MoveDefinition = {
    type: 'motion',
    name: string,
    motions: Motion[]
}

// @ts-ignore
const is_move_definition = (_: MotionDefinition): _ is MoveDefinition => {
    return _.type === 'motion'
}

export type MotionDefs = MotionDefinition[]



export function motion_timeline(program: string) {
    let parser = new Parser(new Lexer(program))

    let motion = parser.parse_definition() as MoveDefinition


    let time = 0

    return {
        get all() {
            return motion
        },
        get motions() {
            let motions = motion.motions
            let i = motions.findIndex(_ => is_motion_delay(_))
            return {
                motions: i === -1 ? motions : motions.slice(0, i),
                name: motion.name
            }
        },
        update(delta: number) {
            time += delta

            let motions = motion.motions

            if (motions.length === 0) {
                return
            }

            let at_delay = motions[0]

            if (is_motion_delay(at_delay)) {

            } else {
                motion.motions = motions.splice(1)
            }

        }
    }
}