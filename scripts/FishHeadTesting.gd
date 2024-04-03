extends RigidBody2D

var axis
var torque = 53000
var thrust = 10000/2
var ldamp = 10

var con_force = 0	#constaht force, built up to a cap from swimming, redirected based on direction of head
var min_cf = 0
var max_cf = 150000
var speed_decay = 2222

var in_water = false

@onready var fish_body = $"../FishBody"
@onready var fish_tail = $"../FishTail"

# Called when the node enters the scene tree for the first time.
func _ready():
	linear_damp = ldamp
	var temp
	
	pass # Replace with function body.

func _integrate_forces(s:PhysicsDirectBodyState2D):
	
	pass

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _physics_process(delta):
	var ang_dif = angle_difference(self.transform.get_rotation(), fish_body.transform.get_rotation())
	axis = Input.get_axis('l','o')
	if abs(ang_dif) < PI/9 or sign(ang_dif) == axis:
		apply_torque(torque*axis)
		#apply_central_force(Vector2(thrust*abs(angular_velocity)*abs(axis)/8,0).rotated(fish_head.rotation))
	con_force += -speed_decay + thrust*abs(fish_tail.angular_velocity)/8
	con_force = clamp(con_force,min_cf,max_cf)
	set_constant_force(Vector2(0,0))
	add_constant_central_force(Vector2(con_force,0).rotated(rotation*1.6))
	print(rotation + fish_body.rotation)
		
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












#extends RigidBody2D
#
#var axis
#var torque = 600000
#var thrust = 5000/2
#
#var con_force = 0	#constaht force, built up to a cap from swimming, redirected based on direction of head
#
#var in_water = false
#@onready var fish_body = $"../FishBody"
#
## Called when the node enters the scene tree for the first time.
#func _ready():
	#pass # Replace with function body.
#
#
## Called every frame. 'delta' is the elapsed time since the previous frame.
#func _physics_process(delta):
	#var ang_dif = angle_difference(self.transform.get_rotation(), fish_body.transform.get_rotation())
	#axis = Input.get_axis('l','o')
	#if abs(ang_dif) < PI/9 or sign(ang_dif) == axis:
		#print(angular_velocity)
		#apply_torque(torque*axis)
		#apply_central_force(Vector2(thrust*abs(angular_velocity)*abs(axis)/8,0).rotated(rotation))
		
		#if sign(ang_dif) != axis:
			#print(axis)

#
#extends RigidBody2D
#
#var axis
#var torque = 600000
#
#var in_water = false
#@onready var fish_body = $"../FishBody"
#
## Called when the node enters the scene tree for the first time.
#func _ready():
	#pass # Replace with function body.
#
#
## Called every frame. 'delta' is the elapsed time since the previous frame.
#func _physics_process(delta):
	#var ang_dif = angle_difference(self.transform.get_rotation(), fish_body.transform.get_rotation())
	#axis = Input.get_axis('l','o')
	#if abs(ang_dif) < PI/9 or sign(ang_dif) == axis:
		#apply_torque(torque*axis)
		#if sign(ang_dif) != axis:
			#print(axis)
