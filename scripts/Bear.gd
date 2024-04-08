extends StaticBody2D

var attacking = false

@export var attack_cd = 2

@onready var pin_joint_2d = $Arm/PinJoint2D
@onready var timer = $Timer


var rotated = 0
var rotate_time = 1
var rotate_distance = 2*PI


# Called when the node enters the scene tree for the first time.
func _ready():
	timer.set_wait_time(attack_cd)
	pass # Replace with function body.


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _physics_process(delta):
	if attacking:
		rotated += delta*2*PI/rotate_time
		rotate(delta*2*PI/rotate_time)
		if rotated >= rotate_distance:
			rotate(rotate_distance - delta*2*PI/rotate_time)
			attacking = false
			pin_joint_2d.set_motor_enabled(false)
			rotated  = 0
			timer.start()

func attack_off_cd():
	attacking = true
	pin_joint_2d.set_motor_enabled(true)

