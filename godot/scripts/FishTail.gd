extends RigidBody2D

var axis
@export var torque = 600000
var thrust = 10000/2
var flop_thrust = 2000

var con_force = 0	#constaht force, built up to a cap from swimming, redirected based on direction of head
var min_cf = 0
var max_cf = 20000
var speed_decay = 2222

var in_water = false

var last_dir = 0

@onready var fish_body = $"../FishBody"
@onready var fish_head = $"../FishHead"

# Called when the node enters the scene tree for the first time.
func _ready():
	pass # Replace with function body.


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _physics_process(delta):
	var ang_dif = angle_difference(self.transform.get_rotation(), fish_body.transform.get_rotation())
	axis = Input.get_axis('f','p')
	if abs(ang_dif) < PI/9 or sign(ang_dif) == axis:
		apply_torque(torque*axis)
		#always apply this?
		#print(angular_velocity)
		#apply_central_force(Vector2(thrust*abs(angular_velocity)*abs(axis)/8,0).rotated(fish_head.rotation))
	elif sign(ang_dif) != last_dir:
		fish_body.apply_central_impulse(Vector2(flop_thrust,0).rotated(fish_body.rotation))
		last_dir = sign(ang_dif)
	#con_force += -speed_decay + thrust*abs(angular_velocity)*abs(axis)/8
	#con_force = clamp(con_force,min_cf,max_cf)
	#set_constant_force(Vector2(0,0))
	#add_constant_central_force(Vector2(con_force,0).rotated(fish_head.rotation*2 + fish_body.rotation))

		
		#if sign(ang_dif) != axis:
			#print(axis)


#extends RigidBody2D
#
#var fp
#var torque = 1000
#
## Called when the node enters the scene tree for the first time.
#func _ready():
	#pass # Replace with function body.
#
#
## Called every frame. 'delta' is the elapsed time since the previous frame.
#func _physics_process(delta):
	#fp = Input.get_axis('f','p')
	#apply_torque(400000*fp)
	#if fp != 0:
		#print(fp)


