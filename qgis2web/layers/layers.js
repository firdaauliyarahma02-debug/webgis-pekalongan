ol.proj.proj4.register(proj4);
//ol.proj.get("EPSG:3857").setExtent([12205898.576958, -769888.070931, 12210089.949273, -767682.530257]);
var wms_layers = [];


        var lyr_ESRISatellite_0 = new ol.layer.Tile({
            'title': 'ESRI Satellite',
            'type':'base',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
            attributions: ' ',
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            })
        });
var format_Bangunanumumlainnya_1 = new ol.format.GeoJSON();
var features_Bangunanumumlainnya_1 = format_Bangunanumumlainnya_1.readFeatures(json_Bangunanumumlainnya_1, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_Bangunanumumlainnya_1 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_Bangunanumumlainnya_1.addFeatures(features_Bangunanumumlainnya_1);
var lyr_Bangunanumumlainnya_1 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_Bangunanumumlainnya_1, 
                style: style_Bangunanumumlainnya_1,
                popuplayertitle: 'Bangunan umum lainnya',
                interactive: true,
                title: '<img src="styles/legend/Bangunanumumlainnya_1.png" /> Bangunan umum lainnya'
            });
var format_Hotel_2 = new ol.format.GeoJSON();
var features_Hotel_2 = format_Hotel_2.readFeatures(json_Hotel_2, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_Hotel_2 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_Hotel_2.addFeatures(features_Hotel_2);
var lyr_Hotel_2 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_Hotel_2, 
                style: style_Hotel_2,
                popuplayertitle: 'Hotel',
                interactive: true,
                title: '<img src="styles/legend/Hotel_2.png" /> Hotel'
            });
var format_Rumah_Sakit_3 = new ol.format.GeoJSON();
var features_Rumah_Sakit_3 = format_Rumah_Sakit_3.readFeatures(json_Rumah_Sakit_3, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_Rumah_Sakit_3 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_Rumah_Sakit_3.addFeatures(features_Rumah_Sakit_3);
var lyr_Rumah_Sakit_3 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_Rumah_Sakit_3, 
                style: style_Rumah_Sakit_3,
                popuplayertitle: 'Rumah_Sakit',
                interactive: true,
                title: '<img src="styles/legend/Rumah_Sakit_3.png" /> Rumah_Sakit'
            });
var format_Sekolah_4 = new ol.format.GeoJSON();
var features_Sekolah_4 = format_Sekolah_4.readFeatures(json_Sekolah_4, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_Sekolah_4 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_Sekolah_4.addFeatures(features_Sekolah_4);
var lyr_Sekolah_4 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_Sekolah_4, 
                style: style_Sekolah_4,
                popuplayertitle: 'Sekolah',
                interactive: true,
                title: '<img src="styles/legend/Sekolah_4.png" /> Sekolah'
            });

lyr_ESRISatellite_0.setVisible(true);lyr_Bangunanumumlainnya_1.setVisible(true);lyr_Hotel_2.setVisible(true);lyr_Rumah_Sakit_3.setVisible(true);lyr_Sekolah_4.setVisible(true);
var layersList = [lyr_ESRISatellite_0,lyr_Bangunanumumlainnya_1,lyr_Hotel_2,lyr_Rumah_Sakit_3,lyr_Sekolah_4];
lyr_Bangunanumumlainnya_1.set('fieldAliases', {'osm_id': 'osm_id', 'osm_type': 'osm_type', 'access_roo': 'access_roo', 'addr_stree': 'addr_stree', 'roof_mater': 'roof_mater', 'addr_house': 'addr_house', 'building': 'building', 'building_m': 'building_m', 'name': 'name', });
lyr_Hotel_2.set('fieldAliases', {'full_id': 'full_id', 'osm_id': 'osm_id', 'osm_type': 'osm_type', 'building': 'building', 'website': 'website', 'tourism': 'tourism', 'phone': 'phone', 'name': 'name', 'internet_access:fee': 'internet_access:fee', 'internet_access': 'internet_access', 'fax': 'fax', 'email': 'email', 'building:material': 'building:material', 'building:levels': 'building:levels', 'addr:street': 'addr:street', 'addr:postcode': 'addr:postcode', 'addr:housenumber': 'addr:housenumber', 'addr:city': 'addr:city', });
lyr_Rumah_Sakit_3.set('fieldAliases', {'full_id': 'full_id', 'osm_id': 'osm_id', 'osm_type': 'osm_type', 'healthcare': 'healthcare', 'operator:type': 'operator:type', 'operator': 'operator', 'healthcare:speciality': 'healthcare:speciality', 'building': 'building', 'phone': 'phone', 'emergency': 'emergency', 'addr:street': 'addr:street', 'addr:postcode': 'addr:postcode', 'addr:housenumber': 'addr:housenumber', 'addr:city': 'addr:city', 'name': 'name', 'amenity': 'amenity', });
lyr_Sekolah_4.set('fieldAliases', {'full_id': 'full_id', 'osm_id': 'osm_id', 'osm_type': 'osm_type', 'building': 'building', 'website': 'website', 'phone': 'phone', 'name': 'name', 'addr:street': 'addr:street', 'addr:postcode': 'addr:postcode', 'addr:housenumber': 'addr:housenumber', 'addr:city': 'addr:city', });
lyr_Bangunanumumlainnya_1.set('fieldImages', {'osm_id': 'Range', 'osm_type': 'TextEdit', 'access_roo': 'TextEdit', 'addr_stree': 'TextEdit', 'roof_mater': 'TextEdit', 'addr_house': 'TextEdit', 'building': 'TextEdit', 'building_m': 'TextEdit', 'name': 'TextEdit', });
lyr_Hotel_2.set('fieldImages', {'full_id': 'TextEdit', 'osm_id': 'TextEdit', 'osm_type': 'TextEdit', 'building': 'TextEdit', 'website': 'TextEdit', 'tourism': 'TextEdit', 'phone': 'TextEdit', 'name': 'TextEdit', 'internet_access:fee': 'TextEdit', 'internet_access': 'TextEdit', 'fax': 'TextEdit', 'email': 'TextEdit', 'building:material': 'TextEdit', 'building:levels': 'TextEdit', 'addr:street': 'TextEdit', 'addr:postcode': 'TextEdit', 'addr:housenumber': 'TextEdit', 'addr:city': 'TextEdit', });
lyr_Rumah_Sakit_3.set('fieldImages', {'full_id': 'TextEdit', 'osm_id': 'TextEdit', 'osm_type': 'TextEdit', 'healthcare': 'TextEdit', 'operator:type': 'TextEdit', 'operator': 'TextEdit', 'healthcare:speciality': 'TextEdit', 'building': 'TextEdit', 'phone': 'TextEdit', 'emergency': 'TextEdit', 'addr:street': 'TextEdit', 'addr:postcode': 'TextEdit', 'addr:housenumber': 'TextEdit', 'addr:city': 'TextEdit', 'name': 'TextEdit', 'amenity': 'TextEdit', });
lyr_Sekolah_4.set('fieldImages', {'full_id': 'TextEdit', 'osm_id': 'TextEdit', 'osm_type': 'TextEdit', 'building': 'TextEdit', 'website': 'TextEdit', 'phone': 'TextEdit', 'name': 'TextEdit', 'addr:street': 'TextEdit', 'addr:postcode': 'TextEdit', 'addr:housenumber': 'TextEdit', 'addr:city': 'TextEdit', });
lyr_Bangunanumumlainnya_1.set('fieldLabels', {'osm_id': 'hidden field', 'osm_type': 'hidden field', 'access_roo': 'hidden field', 'addr_stree': 'inline label - visible with data', 'roof_mater': 'hidden field', 'addr_house': 'hidden field', 'building': 'hidden field', 'building_m': 'hidden field', 'name': 'header label - always visible', });
lyr_Hotel_2.set('fieldLabels', {'full_id': 'hidden field', 'osm_id': 'hidden field', 'osm_type': 'hidden field', 'building': 'hidden field', 'website': 'inline label - visible with data', 'tourism': 'hidden field', 'phone': 'inline label - visible with data', 'name': 'header label - always visible', 'internet_access:fee': 'hidden field', 'internet_access': 'hidden field', 'fax': 'inline label - visible with data', 'email': 'inline label - visible with data', 'building:material': 'hidden field', 'building:levels': 'hidden field', 'addr:street': 'inline label - visible with data', 'addr:postcode': 'inline label - visible with data', 'addr:housenumber': 'inline label - visible with data', 'addr:city': 'inline label - always visible', });
lyr_Rumah_Sakit_3.set('fieldLabels', {'full_id': 'hidden field', 'osm_id': 'hidden field', 'osm_type': 'hidden field', 'healthcare': 'hidden field', 'operator:type': 'hidden field', 'operator': 'hidden field', 'healthcare:speciality': 'hidden field', 'building': 'hidden field', 'phone': 'inline label - visible with data', 'emergency': 'hidden field', 'addr:street': 'inline label - visible with data', 'addr:postcode': 'inline label - visible with data', 'addr:housenumber': 'inline label - visible with data', 'addr:city': 'inline label - always visible', 'name': 'header label - always visible', 'amenity': 'hidden field', });
lyr_Sekolah_4.set('fieldLabels', {'full_id': 'hidden field', 'osm_id': 'hidden field', 'osm_type': 'hidden field', 'building': 'hidden field', 'website': 'inline label - visible with data', 'phone': 'inline label - visible with data', 'name': 'header label - always visible', 'addr:street': 'inline label - visible with data', 'addr:postcode': 'inline label - visible with data', 'addr:housenumber': 'inline label - visible with data', 'addr:city': 'inline label - always visible', });
lyr_Sekolah_4.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});