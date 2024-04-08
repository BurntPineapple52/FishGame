extends RigidBody2D

var axis
@export var torque = 530000
var thrust = 50000
#var ldamp = 10
var health = 100 # Example health variable
var damage_multiplier = 0.1 # Adjusts how much damage is taken based on speed

var con_force = 0	#constaht force, built up to a cap from swimming, redirected based on direction of head
var min_cf = 0
var max_cf = 15000
var speed_decay = 2222

var in_water = false


@onready var fish_body = $"../FishBody"
@onready var fish_tail = $"../FishTail"

# preload the detached tail 
var detached_tail = preload("res://scenes/units/fish_guy_tutorial_tail.tscn")

# Called when the node enters the scene tree for the first time.
func _ready():
	#linear_damp = ldamp
	#var temp
	# Connect the body_entered signal to a function that handles the collision
	connect("body_entered", Callable(self, "_on_body_entered"))
	
	
	
	




#func _integrate_forces(s:PhysicsDirectBodyState2D):
	#
	#pass

func _on_body_entered(body: Node):
	print("DamageBodyRegistered1")
	if body is RigidBody2D:
		print("DamageBodyRegistered2")
		# Assuming 'linear_velocity' is the velocity of the player
		# Calculate the relative velocity between the player and the collided body
		var relative_velocity: Vector2 = body.linear_velocity - linear_velocity
		var speed_of_impact: float = relative_velocity.length()

		# Calculate and apply damage based on the speed of impact
		var damage: float = speed_of_impact * damage_multiplier
		if damage >= 1:
			health -= damage
			print("damaged! " + str(damage))

		
		
		# Check for player health
		if health <= 90.0 && health >= 60.0:
			#Get the sprite2d node
			var sprite_node = get_node("Sprite2D")
			
			#load the sprite texture
			var new_sprite_texture = load("res://assets/sprites/player/fish_head_smashed.png")
			
			# Set the face smash
			sprite_node.texture = new_sprite_texture
			
		if health <= 0.0:
			print("Player defeated")
			# Handle player defeat here (restart level, show game over screen, etc.)


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _physics_process(delta):
	var ang_dif = angle_difference(self.transform.get_rotation(), fish_body.transform.get_rotation())
	axis = Input.get_axis('l','o')
	if abs(ang_dif) < PI/9 or sign(ang_dif) == axis:
		apply_torque(torque*axis)
		
		#apply_central_force(Vector2(thrust*abs(angular_velocity)*abs(axis)/8,0).rotated(fish_head.rotation))
	#con_force += -speed_decay + thrust*abs(fish_tail.angular_velocity)/8
	#con_force = clamp(con_force,min_cf,max_cf)
	#set_constant_force(Vector2(0,0))
	#add_central_force(Vector2(con_force,0).rotated(rotation*1.6))
	if in_water:
		apply_central_force(Vector2(thrust*abs(fish_tail.angular_velocity)/8,0).rotated(rotation))
		#print(rotation + fish_body.rotation)
		print(linear_velocity)
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
