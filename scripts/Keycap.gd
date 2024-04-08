extends Sprite2D

@export var keybind = KEY_F

var fade_time = .3
var fade_speed = 1/fade_time

var target_color = Color("626262")
var origin_color = Color("ffffff")


# Called when the node enters the scene tree for the first time.
func _ready():
	pass # Replace with function body.


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	if Input.is_key_pressed(keybind):
		var color = modulate
		if(modulate != target_color):
			modulate.r = move_toward(modulate.r,target_color.r,fade_speed*delta)
			modulate.g = move_toward(modulate.g,target_color.g,fade_speed*delta)
			modulate.b = move_toward(modulate.b,target_color.b,fade_speed*delta)
	elif modulate != origin_color:
		modulate.r = move_toward(modulate.r,origin_color.r,fade_speed*delta)
		modulate.g = move_toward(modulate.g,origin_color.g,fade_speed*delta)
		modulate.b = move_toward(modulate.b,origin_color.b,fade_speed*delta)
		
