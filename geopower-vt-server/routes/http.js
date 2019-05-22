var BufferRequest = {
    seqRequest: function (client, sort, geojson, key, limit, minlon, maxlat, maxlon, minlat,sszrq) {
        //分页查询
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
                            "geometry": {
                                "shape": {
                                    "type": "envelope",
                                    "coordinates": [[minlon, maxlat], [maxlon, minlat]]
                                }
                            }
                        }
                    }
                },
                "search_after": sort,
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
                    console.log(dataArr.length);
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
                    this.seqRequest(client, result.body.hits.hits[result.body.hits.hits.length - 1]["sort"], geojson, key, limit, minlon, maxlat, maxlon, minlat,sszrq)
                }
            }
        });
        return geojson;
    }
};

module.exports = BufferRequest;