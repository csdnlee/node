var http = require('http');
var express = require('express');
var router = express.Router();
var path = require('path');
var fs = require('fs');
var vtpbf = require('vt-pbf');
var geojsonVt = require('geojson-vt');
var async = require('async');
var httpRequest = require('./query');
var bufferRequest = require('./http');
var RegionData = require('./region');

//ES获取矢量切片
router.get('/esSearchTiles', function (req, res, next) {
    var x = Number(req.query.x);//瓦片所在行数
    var y = Number(req.query.y);//瓦片所在列数
    var z = Number(req.query.z);//瓦片所在层级
    var tilecache = req.query.tilecache;//是否启用缓存
    var sszrq = req.query.sszrq;//所属责任区
    //行列号转左上角经纬度范围
    var minlon = x / Math.pow(2, z) * 360 - 180;
    var n_top_left = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
    var maxlat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n_top_left) - Math.exp(-n_top_left)));
    //行列号转右下角经纬度范围
    var maxlon = (x + 1) / Math.pow(2, z) * 360 - 180;
    var n_bottom_right = Math.PI - 2 * Math.PI * (y + 1) / Math.pow(2, z);
    var minlat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n_bottom_right) - Math.exp(-n_bottom_right)));
    //判断瓦片是否已存在
    var exists = fs.existsSync('F:/project/geopower-vt-server/es/' + x + '_' + y + '_' + z + '.pbf');
    if ((exists == true) && (tilecache == true)) {
        console.log("从缓存读取...");
        res.sendFile(path.join('F:/project/geopower-vt-server/es', '/') + x + '_' + y + '_' + z + '.pbf');
    } else {
        console.log("从ES读取...");
        var limit = 10000;//每页记录数
        const {Client} = require('@elastic/elasticsearch');
        const client = new Client({node: 'http://127.0.0.1:9201'});//查询一个节点
        //多个函数并行执行
        async.parallel([
            function (callback) {
                var key = "linestring_2";
                var geojson = {
                    "type": "FeatureCollection",
                    "features": []
                };
                //查询线
                client.search({
                    index: key,
                    body: {
                        "size": limit,
                        "query": {
                            "bool": {
                                "must": {
                                    "match": {
                                        "sszrq": sszrq
                                    }
                                },
                                "filter": {
                                    "geo_shape": {
                                        "geometry": {
                                            "shape": {
                                                "type": "envelope",
                                                "coordinates": [[minlon, maxlat], [maxlon, minlat]]
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "sort": [
                            {
                                "_id": {
                                    "order": "desc"
                                }
                            }
                        ]
                    }
                }, (err, result) => {
                    if (err) {
                        console.log(err);
                    } else {
                        var dataArr = result.body.hits.hits;
                        if (dataArr.length > 0) {
                            var featureObj = {};
                            for (var k = 0; k < dataArr.length; k++) {
                                featureObj = {};
                                featureObj.type="Feature";
                                featureObj.geometry = dataArr[k]["_source"]["geometry"];
                                featureObj.properties = {};
                                featureObj.properties.yxdw = dataArr[k]["_source"]["yxdw"];
                                featureObj.properties.guid = dataArr[k]["_source"]["guid"];
                                featureObj.properties.sbmc = dataArr[k]["_source"]["sbmc"];
                                featureObj.properties.ssds = dataArr[k]["_source"]["ssds"];
                                featureObj.properties.sszrq = dataArr[k]["_source"]["sszrq"];
                                featureObj.properties.tablename = dataArr[k]["_source"]["tablename"];
                                geojson.features.push(featureObj);
                            }
                            geojson = bufferRequest.seqRequest(client, result.body.hits.hits[result.body.hits.hits.length - 1]["sort"], geojson, key, limit, minlon, maxlat, maxlon, minlat,sszrq);
                        }
                        console.log("线的数量：" + geojson.features.length);
                    }
                    return callback(null, geojson, 1);
                });
            },
            function (callback) {
                //查询点
                var key = "point_2";
                var geojson = {
                    "type": "FeatureCollection",
                    "features": []
                };
                if (z > 11) {
                    client.search({
                        index: key,
                        body: {
                            "size": limit,
                            "query": {
                                "bool": {
                                    "must": {
                                        "match": {
											"sszrq": sszrq
										}
                                    },
                                    "filter": {
                                        "geo_shape": {
                                            "geometry": {
                                                "shape": {
                                                    "type": "envelope",
                                                    "coordinates": [[minlon, maxlat], [maxlon, minlat]]
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            "sort": [
                                {
                                    "_id": {
                                        "order": "desc"
                                    }
                                }
                            ]
                        }
                    }, (err, result) => {
                        if (err) {
                            console.log(err);
                        } else {
                            var dataArr = result.body.hits.hits;
                            if (dataArr.length > 0) {
                                var featureObj = {};
                                for (var k = 0; k < dataArr.length; k++) {
                                    featureObj = {};
                                    featureObj.type="Feature";
                                    featureObj.geometry = dataArr[k]["_source"]["geometry"];
                                    featureObj.properties = {};
                                    featureObj.properties.yxdw = dataArr[k]["_source"]["yxdw"];
                                    featureObj.properties.guid = dataArr[k]["_source"]["guid"];
                                    featureObj.properties.sbmc = dataArr[k]["_source"]["sbmc"];
                                    featureObj.properties.ssds = dataArr[k]["_source"]["ssds"];
                                    featureObj.properties.sszrq = dataArr[k]["_source"]["sszrq"];
                                    featureObj.properties.tablename = dataArr[k]["_source"]["tablename"];
                                    geojson.features.push(featureObj);
                                }
                                geojson = bufferRequest.seqRequest(client, result.body.hits.hits[result.body.hits.hits.length - 1]["sort"], geojson, key, limit, minlon, maxlat, maxlon, minlat,sszrq);
                            }
                            console.log("点的数量：" + geojson.features.length);
                        }
                        return callback(null, geojson, 2);
                    });
                } else {
                    return callback(null, geojson, 2);
                }
            }
        ], function (err, results, total) {
            //将geojson转化为buff
            var newBuffer = null;
            var buff_line = null;
            var buff_point = null;
            if (results[0][0].features.length > 0) {
                var tileindex_line = geojsonVt(results[0][0], {
                    maxZoom: 18,  // max zoom to preserve detail on; can't be higher than 24
                    tolerance: -1, // simplification tolerance (higher means simpler)
                    extent: 4096, // tile extent (both width and height)
                    buffer: 64,   // tile buffer on each side
                    debug: 0,     // logging level (0 to disable, 1 or 2)
                    lineMetrics: false, // whether to enable line metrics tracking for LineString/MultiLineString features
                    promoteId: null,    // name of a feature property to promote to feature.id. Cannot be used with `generateId`
                    generateId: false,  // whether to generate feature ids. Cannot be used with `promoteId`
                    indexMaxZoom: 5,       // max zoom in the initial tile index
                    indexMaxPoints: 10000000 // max number of points per tile in the index
                });
                var tile_line = tileindex_line.getTile(z, x, y);
                buff_line = vtpbf.fromGeojsonVt({"line": tile_line});
                if (newBuffer != null) {
                    newBuffer = Buffer.concat([newBuffer, buff_line]);
                } else {
                    newBuffer = buff_line;
                }
            }
            if (results[1][0].features.length > 0) {
                var tileindex_point = geojsonVt(results[1][0], {
                    maxZoom: 18,  // max zoom to preserve detail on; can't be higher than 24
                    tolerance: -1, // simplification tolerance (higher means simpler)
                    extent: 4096, // tile extent (both width and height)
                    buffer: 64,   // tile buffer on each side
                    debug: 0,     // logging level (0 to disable, 1 or 2)
                    lineMetrics: false, // whether to enable line metrics tracking for LineString/MultiLineString features
                    promoteId: null,    // name of a feature property to promote to feature.id. Cannot be used with `generateId`
                    generateId: false,  // whether to generate feature ids. Cannot be used with `promoteId`
                    indexMaxZoom: 16,       // max zoom in the initial tile index
                    indexMaxPoints: 10000000 // max number of points per tile in the index
                });
                var tile_point = tileindex_point.getTile(z, x, y);
                buff_point = vtpbf.fromGeojsonVt({"point": tile_point});
                if (newBuffer != null) {
                    newBuffer = Buffer.concat([newBuffer, buff_point]);
                } else {
                    newBuffer = buff_point;
                }
            }
            if (newBuffer == null) {
                newBuffer = ""
            }
            fs.writeFileSync('F:/project/geopower-vt-server/es/' + x + '_' + y + "_" + z + '.pbf', newBuffer);
            res.sendFile(path.join('F:/project/geopower-vt-server/es', '/') + x + '_' + y + '_' + z + '.pbf');
        });
    }
});

//ES获取geojson
router.get('/esSearchGeoJson', function (req, res, next) {
    var featureType = Number(req.query.featureType);//要素类型，0点 1线 2面
    var citycode = Number(req.query.citycode);//地区行政编码
    var bounds = null; //行政区划范围
    for (var i = 0; i < RegionData.features.length; i++) {
        if (RegionData.features[i].properties.adcode == citycode) {
            bounds = RegionData.features[i].geometry;
            break;
        }
    }
    var key = null;//索引名称
    if (featureType == 0) {
        key = "point_2";
    } else if (featureType == 1) {
        key = "linestring_2";
    }
    var limit = 10000;//每页记录数
    const {Client} = require('@elastic/elasticsearch');
    const client = new Client({node: 'http://127.0.0.1:9201'});//查询一个节点
    client.search({
        index: key,
        body: {
            "size": limit,
            "query": {
                "bool": {
                    "must": {
                        "match_all": {}
                    },
                    "filter": {
                        "geo_shape": {
                            "geometry": {
                                "shape": bounds
                            }
                        }
                    }
                }
            },
            "sort": [
                {
                    "_id": {
                        "order": "desc"
                    }
                }
            ]
        }
    }, (err, result) => {
        if (err) {
            console.log(err);
            res.send({"err": +err});
        } else {
            var geojson = {
                "type": "FeatureCollection",
                "features": []
            };
            var dataArr = result.body.hits.hits;
            if (dataArr.length > 0) {
                var featureObj = {};
                for (var k = 0; k < dataArr.length; k++) {
                    featureObj = {};
                    featureObj.type="Feature";
                    featureObj.geometry = dataArr[k]["_source"]["geometry"];
                    featureObj.properties = {};
                    featureObj.properties.yxdw = dataArr[k]["_source"]["yxdw"];
                    featureObj.properties.guid = dataArr[k]["_source"]["guid"];
                    featureObj.properties.sbmc = dataArr[k]["_source"]["sbmc"];
                    featureObj.properties.ssds = dataArr[k]["_source"]["ssds"];
                    featureObj.properties.sszrq = dataArr[k]["_source"]["sszrq"];
                    featureObj.properties.tablename = dataArr[k]["_source"]["tablename"];
                    geojson.features.push(featureObj);
                }
                geojson = httpRequest.seqRequest(client, result.body.hits.hits[result.body.hits.hits.length - 1]["sort"], geojson, key, bounds, limit);
            }
            if (key == "point") {
                console.log("点的数量：" + geojson.features.length);
            } else if (key == "linestring") {
                console.log("线的数量：" + geojson.features.length);
            }
            res.send(geojson);
        }
    });
});

module.exports = router;