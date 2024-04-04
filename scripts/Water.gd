extends Area2D

var buoyancy = -4000
var a_damp = 50
var l_damp = 4
var land_a_damp = 25
var land_l_damp = 0

# Called when the node enters the scene tree for the first time.
func _ready():
	pass # Replace with function body.


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass

func _on_body_entered(body:RigidBody2D):
	if body.is_in_group("physics"):
		body.add_constant_central_force(Vector2(0,buoyancy))
		body.set_angular_damp(a_damp)
		body.set_linear_damp(l_damp)
		
		if body.is_in_group("player"):
			body.in_water = true
		print("nul gravity")


func _on_body_exited(body:RigidBody2D):
	body.add_constant_central_force(Vector2(0,-buoyancy))
	body.set_constant_force(Vector2(0,0))
	body.set_angular_damp(land_a_damp)
	body.set_linear_damp(land_l_damp)
	if body.is_in_group("player"):
		body.in_water = false
