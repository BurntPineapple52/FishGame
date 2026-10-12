extends Node2D

@export var spawn_rate = 3.0
@export var spawn_variability = .4

const LOG = preload("res://scenes/environment/log.tscn")
@onready var environment = $"../Environment"

@onready var timer = $Timer
@onready var water_container = $"../Water_Container"


@export var heights = [300, 150, 300, 10, 600, 200, 600, 200, 1000, 40]
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
