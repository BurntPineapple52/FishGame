extends StaticBody2D

@export var grass_length = 4 #in segments
var sprite_dict = {'segments':[preload("res://assets/sprites/environment/riverweed_segment_1.png"),preload("res://assets/sprites/environment/riverweed_segment_2.png"),preload("res://assets/sprites/environment/riverweed_segment_3.png")],'end':[preload("res://assets/sprites/environment/riverweed_end_1.png"),preload("res://assets/sprites/environment/riverweed_end_2.png")]}
var segment_res = preload("res://scenes/environment/rivergrass_segment.tscn")
var last = self


@onready var timer = $Timer

var timer_len = .2
var timer_rand = .2
var impulse_triggered = false
var impulse_strength = 200

var height = 36
# Called when the node enters the scene tree for the first time.
func _ready():
	#generate grass_length-1 segments, and finish with an end segment
	for n in range(grass_length-1):
		var seg = segment_res.instantiate()
		add_child(seg)
		seg.get_node("Sprite2D").set_texture(sprite_dict['segments'][randi_range(0,sprite_dict['segments'].size()-1)])
		seg.position.y = -height*n - height/2
		var pj = seg.get_node("PinJoint2D")
		
		pj.set_node_a(last.get_path())
		pj.set_node_b(seg.get_path())
		last = seg
	
	var end = segment_res.instantiate()
	add_child(end)
	end.get_node("Sprite2D").set_texture(sprite_dict['end'][randi_range(0,sprite_dict['end'].size()-1)])
	end.position.y = -height*(grass_length-1) - height/2
	var pj = end.get_node("PinJoint2D")
	pj.set_node_a(last.get_path())
	pj.set_node_b(end.get_path())


func _physics_process(delta):
	if impulse_triggered:
		impulse_triggered = false
		var children = get_children()
		children[2+randi()%(children.size()-2)].apply_central_impulse(Vector2(impulse_strength*[-1,-1].pick_random(),0))


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	pass


func _on_timer_timeout():
	timer.set_wait_time(timer_len + randf_range(0,timer_rand))
	impulse_triggered = true

