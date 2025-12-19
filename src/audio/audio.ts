// @ts-ignore
async function load_audio(ctx: AudioContext, src: string) {
    const buffer = await fetch(src).then(_ => _.arrayBuffer())
    const audio_buffer = await ctx.decodeAudioData(buffer)
    return audio_buffer
}

export type AudioContent = {
    load: () => Promise<void>
    play: (name: string, loop?: boolean, volume?: number) => void
    buffers: Record<string, AudioBuffer>
}

export function AudioContent(): AudioContent {

    let ctx = new AudioContext()

    let buffers: Record<string, AudioBuffer> = { }

    async function load() {
        //buffers['pickup'] = await load_audio(ctx, '/sfx/pickup.mp3')
    }

    function play(music: string, loop: boolean = false, volume: number = .9) {
        let buffer = buffers[music]
        const source = ctx.createBufferSource()
        source.buffer = buffer

        let gain = ctx.createGain()
        gain.gain.value = volume


        gain.connect(ctx.destination)
        source.connect(gain)
        source.loop = loop

        source.start()

        return () => {
            source.stop()
        }
    }

    return {
        load,
        play,
        buffers
    }
}