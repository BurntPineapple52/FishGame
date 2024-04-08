extends RigidBody2D

var in_water = false
@onready var fish_guy = $".."

# Called when the node enters the scene tree for the first time.
func _ready():
	pass # Replace with function body.


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass

func smack(force, torque, damage=0):
	apply_central_impulse(force)
	apply_torque(torque)
	if damage:
		fish_guy.take_damage(damage)
