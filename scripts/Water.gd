extends Area2D

var buoyancy = -5400
var damp = 150

# Called when the node enters the scene tree for the first time.
func _ready():
	pass # Replace with function body.


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass

func _on_body_entered(body:RigidBody2D):
	if body.is_in_group("physics"):
		body.add_constant_central_force(Vector2(0,buoyancy))
		body.set_angular_damp(damp)
		print("nul gravity")


func _on_body_exited(body:RigidBody2D):
	body.add_constant_central_force(Vector2(0,-buoyancy))
	body.set_angular_damp(0)
