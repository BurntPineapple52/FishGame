extends PinJoint2D

var flop_vel = 200;

# Called when the node enters the scene tree for the first time.
func _ready():
	pass # Replace with function body.


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass

func _input(event):
	
	if event.is_action("f"):
		set_motor_target_velocity(flop_vel)
	elif event.is_action("l"):
		set_motor_target_velocity(-flop_vel)
