shader_type canvas_item;

uniform vec4 tint : source_color = vec4(1.0);
uniform sampler2D screen_texture : hint_screen_texture, filter_nearest;

void vertex() {
	// Called for every vertex the material is visible on.
}

void fragment() {
	// Called for every pixel the material is visible on.
	vec4 color = texture(screen_texture, SCREEN_UV);
	
	//can change the value to make more transparent(smaller numbers) or opaque(larger numbers)
	color = mix(color, tint, 0.1);
	color = mix(vec4(0.5),color,1.4);
	
	COLOR = color;
}

//void light() {
	// Called for every pixel for every light affecting the CanvasItem.
	// Uncomment to replace the default light processing function with this one.
//}
