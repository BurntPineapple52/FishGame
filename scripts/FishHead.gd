extends RigidBody2D

var lo
var torque = 1000

# Called when the node enters the scene tree for the first time.
func _ready():
	pass # Replace with function body.


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _physics_process(delta):
	lo = Input.get_axis('l','o')
	apply_torque(400000*lo)
	if lo != 0:
		print(lo)
