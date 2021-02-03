import type { Feature } from '@wixc3/engine-core/src';

export interface Link {
    source: string;
    target: string;
}

export const buildFeatureLinks = (
    entry: Feature,
    visitedFeatures: { [propName: string]: number },
    level: number
): Array<Link> => {
    const res = [] as Array<Link>;
    const deps = entry.dependencies as Array<Feature>;
    for (const dep of deps) {
        res.push({ source: entry.id, target: dep.id });
        if (!(dep.id in visitedFeatures)) {
            visitedFeatures[dep.id] = level + 1;
        }
    }
    for (const dep of deps) {
        if (visitedFeatures[dep.id] === level + 1) {
            res.push(...buildFeatureLinks(dep, visitedFeatures, level + 1));
        }
    }
    return res;
};

export function template(data: any) {
    return `<!DOCTYPE html><html>
<head>
    <script>
        graph = ${JSON.stringify(data)};
    </script>
    <meta charset="utf-8" />
    <!-- Load d3.js -->
    <script src="https://d3js.org/d3.v4.js"></script>
    <style>
    svg {
      font: 10px sans-serif;
    }
    
    path {
      fill: none;
      stroke: #999;
      stroke-opacity: 0.6;
      stroke-width: 1.5px;
    }
    
    .node circle {
      fill: #d62333;
      stroke: #fff;
      stroke-width: 1px;
    }
    
    </style>
    
</head>
<body>
    <!-- Create a div where the graph will take place -->
    <svg></svg>
    <script>
    var diameter = 600;
    var radius = diameter / 2;
    var innerRadius = radius - 70;
    
    var cluster = d3.cluster()
      .size([360, innerRadius])
      .separation(function(a, b) { return (a.parent == b.parent ? 1 : a.parent.parent == b.parent.parent ? 2 : 4); });
    
    var line = d3.line()
      .x(xAccessor)
      .y(yAccessor)
      .curve(d3.curveBundle.beta(0.7));
    
    var svg = d3.select('svg')
      .attr('width', diameter)
      .attr('height', diameter)
      .append('g')
      .attr('transform', 'translate(' + radius + ',' + radius + ')');
    
    
      var idToNode = {};
    
      graph.nodes.forEach(function (n) {
        idToNode[n.id] = n;
      });
    
      graph.links.forEach(function (e) {
        e.source = idToNode[e.source];
        e.target = idToNode[e.target];
      });
    
      // Find first appearance (volume, book, chapter)
      graph.nodes.forEach(function (n) {
        n.firstChapter = n.group;
      });
    
      var tree = cluster(d3.hierarchy(chapterHierarchy(graph.nodes)).sort());
    
      var leaves = tree.leaves();
    
      var paths = graph.links.map(function (l) {
        var source = leaves.filter(function (d) { return d.data === l.source; })[0];
        var target = leaves.filter(function (d) { return d.data === l.target; })[0];
        return source.path(target);
      });
    
      var link = svg.selectAll('.link')
        .data(paths)
        .enter().append('path')
        .attr('class', 'link')
        .attr('d', function (d) { return line(d) })
        .on('mouseover', function (l) {
          link
            .style('stroke', null)
            .style('stroke-opacity', null);
          d3.select(this)
            .style('stroke', '#d62333')
            .style('stroke-opacity', 1);
          node.selectAll('circle')
            .style('fill', null);
          node.filter(function (n) { return n === l[0] || n === l[l.length - 1]; })
            .selectAll('circle')
            .style('fill', 'black');
        })
        .on('mouseout', function (d) {
          link
            .style('stroke', null)
            .style('stroke-opacity', null);
          node.selectAll('circle')
            .style('fill', null);
        });
    
      var node = svg.selectAll('.node')
        .data(tree.leaves())
        .enter().append('g')
        .attr('class', 'node')
        .attr('transform', function (d) { return 'translate(' + xAccessor(d) + ',' + yAccessor(d) + ')'; })
        .on('mouseover', function (d) {
          node.style('fill', null);
          d3.select(this).selectAll('circle').style('fill', 'black');
          var nodesToHighlight = paths.map(function (e) { return e[0] === d ? e[e.length-1] : e[e.length-1] === d ? e[0] : 0})
            .filter(function (d) { return d; });
          node.filter(function (d) { return nodesToHighlight.indexOf(d) >= 0; })
            .selectAll('circle')
            .style('fill', '#555');
          link
            .style('stroke-opacity', function (link_d) {
              return link_d[0] === d | link_d[link_d.length - 1] === d ? 1 : null;
            })
            .style('stroke', function (link_d) {
              return link_d[0] === d | link_d[link_d.length - 1] === d ? '#d62333' : null;
            });
        })
        .on('mouseout', function (d) {
          link
            .style('stroke-opacity', null)
            .style('stroke', null);
          node.selectAll('circle')
            .style('fill', null);
        });
    
      node.append('circle').attr('r', 4)
        .append('title')
        .text(function (d) { return d.data.name; });
    
      node.append('text')
        .attr('dy', '0.32em')
        .attr('x', function (d) { return d.x < 180 ? 6 : -6; })
        .style('text-anchor', function (d) { return d.x < 180 ? 'start' : 'end'; })
        .attr('transform', function (d) { return 'rotate(' + (d.x < 180 ? d.x - 90 : d.x + 90) + ')'; })
        .text(function (d) { return d.data.firstChapter + ' - ' + d.data.id; });
    
      function chapterCompare (aChaps, bChaps) {
        if (aChaps[0] != bChaps[0])
          return bChaps[0] - aChaps[0];
        else if (aChaps[1] != bChaps[0])
          return bChaps[1] - aChaps[1];
        else if (aChaps[2] != bChaps[2])
          return bChaps[2] - aChaps[2];
        return 0;
      }
    
    function chapterHierarchy (characters) {
      var hierarchy = {
        root: {name: 'root', children: []}
      };
    
      characters.forEach(function (c) {
        var chapter = c.firstChapter;
        var book = 0;
        var volume = 0;
    
        if (!hierarchy[volume]) {
          hierarchy[volume] = {name: volume, children: [], parent: hierarchy['root']};
          hierarchy['root'].children.push(hierarchy[volume]);
        }
    
        if (!hierarchy[book]) {
          hierarchy[book] = {name: book, children: [], parent: hierarchy[volume]};
          hierarchy[volume].children.push(hierarchy[book]);
        }
    
        if (!hierarchy[chapter]) {
          hierarchy[chapter] = {name: chapter, children: [], parent: hierarchy[book]};
          hierarchy[book].children.push(hierarchy[chapter]);
        }
    
        c.parent = hierarchy[chapter];
        hierarchy[chapter].children.push(c);
      });
    
      return hierarchy['root'];
    }
    
    function xAccessor (d) {
      var angle = (d.x - 90) / 180 * Math.PI, radius = d.y;
      return radius * Math.cos(angle);
    }
    
    function yAccessor (d) {
      var angle = (d.x - 90) / 180 * Math.PI, radius = d.y;
      return radius * Math.sin(angle);
    }
    
    </script>
</body></html>`;
}
