extends RigidBody2D

var fp
var torque = 1000

# Called when the node enters the scene tree for the first time.
func _ready():
	pass # Replace with function body.


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _physics_process(delta):
	fp = Input.get_axis('f','p')
	apply_torque(400000*fp)
	if fp != 0:
		print(fp)
