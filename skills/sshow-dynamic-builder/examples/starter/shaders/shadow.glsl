// Shadow: the object's silhouette in a colour, distance px away along angle, behind its own pixels (one read).
vec4 dynamicEffect(vec2 uv, vec4 src) {
    float a = radians(uAngle);
    vec2 offset = vec2(cos(a), sin(a)) * uDistance * uViewportScale * uInputSize.zw;
    float cover = texture(uTexture, clamp(uv - offset, uInputClamp.xy, uInputClamp.zw)).a * uAmount;
    vec4 shadow = vec4(uColor * cover, cover);
    return src + shadow * (1.0 - src.a);
}
