
export async function load_font(font_family: string, url: string, props = {
    style: 'normal',
    weight: '400'
}) {
    const font = new FontFace(font_family, `url(${url})`, props )
    await font.load()
    document.fonts.add(font)
}
