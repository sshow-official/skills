// Stripes: bands of two colours, size px each, turned by rotation and sliding at speed.

// 1 on the first colour's band, 0 on the second's. along is in pixels, so near
// an edge wave * size / PI is the distance to it in pixels: a one-pixel soft
// edge without fwidth, which GLSL ES 1.00 does not have.
float band(float along, float size) {
    float wave = sin(along / size * 3.14159265);
    return clamp(wave * size / 3.14159265 + 0.5, 0.0, 1.0);
}

vec4 dynamicPaint(vec2 uv) {
    vec2 px = uv * uOutputFrame.zw;
    float a = radians(uRotation);
    float along = dot(px, vec2(cos(a), sin(a))) + uTime * uSpeed * uSize;
    return vec4(mix(uColor2, uColor1, band(along, uSize)), 1.0);
}
