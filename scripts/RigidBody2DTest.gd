extends RigidBody2D

var in_water = false

# Called when the node enters the scene tree for the first time.
func _ready():
	pass # Replace with function body.


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _physics_process(delta):
	#apply_central_force(Vector2(0,-1100))
	#apply_torque(20000)
	#apply_force(Vector2(0,100), position)
	pass


func _on_body_entered(body:RigidBody2D):
	if body.is_in_group("player"):
			body.health -= 10
			print("DAMAGE!")
