extends Node2D

@export var spawn_rate = 3
@export var spawn_variability = .4

const LOG = preload("res://scenes/environment/log.tscn")
@onready var environment = $"../Environment"

@onready var timer = $Timer
@onready var water_container = $"../Water_Container"


var heights = [300, 400, 300, 200, 500]
var current = 0

var ff = .5
var drag = .08


# Called when the node enters the scene tree for the first time.
func _ready():
	timer.set_wait_time(spawn_rate)
	pass # Replace with function body.


# Called every frame. 'delta' is the elapsed time since the previous frame.
func _process(delta):
	
	pass

func spawn_log():
	var log = LOG.instantiate()
	log.position = position
	environment.add_child(log)
	log.initialize(heights[current%heights.size()],ff,drag)
	current+=1
