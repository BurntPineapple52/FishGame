extends RigidBody2D

@export var float_force = 1.0
@export var water_drag = 0.05
@export var water_angular_drag = 0.05

@onready var gravity:float = ProjectSettings.get_setting("physics/2d/default_gravity")

var stage
var bounds:Vector2
var water_height = 0.0

var submerged = false

#-----------------------

#modified mass from 1 - 50. may alter 

# Called when the node enters the scene tree for the first time.
func _ready():
	stage = get_parent().get_parent()
	bounds = stage.get_bounds()
	pass # Replace with function body.

func initialize(height,ff,drag):
	print("init")
	water_height = height
	float_force = ff
	water_drag = drag
	
	#float_force = water_height + 1

# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass
	
func _physics_process(delta):
	if position.x < bounds.x or position.x > bounds.y:
		print("deleted")
		queue_free()
	submerged = false
	var depth = global_position.y - water_height
	if depth > 0:
		submerged = true
		apply_central_force(Vector2.UP * float_force * gravity * depth)

func _integrate_forces(state: PhysicsDirectBodyState2D):
	if submerged:
		#0 means no drag, 1 means max drag
		state.linear_velocity *= 1 - water_drag
		state.angular_velocity *= 1 - water_angular_drag

