import { useMemo, useState } from "react";

import Button from "react-bootstrap/Button";

import ProjectService from "../../Application/Project/ProjectService";

import { Project } from "../../Domain/ProductLineEngineering/Entities/Project";
import mx from "../MxGEditor/mxgraph";

type QueryResultProps = {
  index: number;
  result: object | Array<any> | boolean;
  projectService: ProjectService;
  onVisualize: any;
};

function isIterationResult(result: Array<any> | object | boolean): boolean {
  return (
    Array.isArray(result) &&
    result.some((elem) => Array.isArray(elem) && elem.length === 2)
  );
}

function hasFailedIterationResult(
  result: Array<any> | object | boolean
): boolean {
  return (
    Array.isArray(result) &&
    result.some((elem) => Array.isArray(elem) && elem.length === 2 && !elem[1])
  );
}

export default function QueryResult({
  index,
  result,
  projectService,
  onVisualize,
}: QueryResultProps) {
  const [paginationSelection, setPaginationSelection] = useState(0);

  const visibleResults = useMemo(() => {
    if (Array.isArray(result) && isIterationResult(result)) {
      // We know then that these are iteration results
      // We will now strip the first part of the strings in the first element
      return (
        result
          .map((elem) => [
            elem[0].replace("UUID_", "").replaceAll("_", "-"),
            elem[1],
          ])
          // Let's filter only those that are false
          .filter((elem) => !elem[1])
      );
    } else {
      return result;
    }
  }, [result]);

  const handleIterationQueryVisualization = () => {
    //we'll use the ids in the first element of the array to create overlays
    //for the elements in the graph.
    const graph = projectService.getGraph();
    (visibleResults as Array<Array<string | boolean>>).forEach(
      ([elem_id, _]) => {
        // const cell = MxgraphUtils.findVerticeById(graph, elem_id, null);
        const cell = graph.getModel().filterDescendants((cell) => {
          if (cell.value) {
            const uid = cell.value.getAttribute("uid");
            if (uid === elem_id) {
              return true;
            }
          }
          return false;
        })[0];

        //const cell = graph.getModel().getCell(elem_id);
        if (cell) {
          const overlayFrame = new mx.mxCellOverlay(
            new mx.mxImage(
              "images/models/Eo_circle_red_white_no-entry.svg",
              24,
              24
            ),
            "Failed Query"
          );
          overlayFrame.align = mx.mxConstants.ALIGN_LEFT;
          overlayFrame.verticalAlign = mx.mxConstants.ALIGN_TOP;
          overlayFrame.offset = new mx.mxPoint(0, 0);

          overlayFrame.addListener(mx.mxEvent.CLICK, function (_sender, _evt) {
            graph.removeCellOverlay(cell, overlayFrame);
          });

          graph.addCellOverlay(cell, overlayFrame);
          graph.refresh();
        }
      }
    );
  };

  const handleVisualize = () => {
    // Log para depuración
    console.info("Visualizing solution ", index, " of query result", result);

    const graph = projectService.getGraph();

    if (!Array.isArray(result)) {
      // Visualización de un solo resultado de proyecto
      projectService.updateSelection(
        result as Project,
        projectService.getTreeIdItemSelected()
      );
      graph.refresh();
    } else {
      // Si es una lista de resultados (e.g., de iteración)
      result.forEach((item, idx) => {
        const element = item[paginationSelection];
        
        // Buscar la celda en el grafo usando su ID
        const cell = graph.getModel().getCell(element.id);
        
        if (cell) {
          console.log(`Updating properties of cell with ID: ${element.id}`);

          // Emisión de propiedades actualizadas en lugar de crear nuevas celdas
          const properties = element.properties.map((prop: any) => ({
            name: prop.name,
            value: prop.value,
            type: prop.type
          }));

          projectService.getSocket().emit('propertiesChanged', {
            clientId: projectService.getClientId(),
            workspaceId: projectService.getWorkspaceId(),
            projectId: projectService.getProject().id,
            productLineId: projectService.getProductLineSelected().id,
            modelId: projectService.getTreeIdItemSelected(),
            cellId: cell.value.getAttribute('uid'),
            properties
          });

          console.log(`Emitted propertiesChanged for cell ID: ${element.id}`);
        } else {
          console.warn(`Cell with ID ${element.id} not found in graph.`);
        }
      });

      // Refrescar el grafo después de actualizar las propiedades
      graph.refresh();
    }

    // Llamada a la función callback de visualización
    if (onVisualize) {
      onVisualize();
    }
  };


  return (
    <table className="my-2 border border-secondary-subtle rounded-table">
      <tbody>
        <tr>
          <td className="text-center p-1 border border-secondary-subtle">
            Solution {index}
          </td>

          <td className="text-center p-1 border border-secondary-subtle">
            {(isIterationResult(result) &&
              hasFailedIterationResult(result as Array<any>)) ||
            (typeof result === "object" && !isIterationResult(result)) ? (
              <Button size="sm" onClick={handleVisualize}>
                Visualize
              </Button>
            ) : (
              typeof result === "boolean" && (result ? "SAT" : "UNSAT")
            )}
          </td>
        </tr>

        {Array.isArray(visibleResults) && (
          <tr>
            <td
              colSpan={2}
              className="text-center border border-secondary-subtle"
            >
              {visibleResults.length > 0 &&
              !isIterationResult(visibleResults) ? (
                <div
                  className="d-grid justify-content-center gap-1 w-100 p-1"
                  style={{
                    gridTemplateColumns: "repeat(auto-fit, minmax(40px, 50px))",
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  {visibleResults.map((_, idx) => (
                    <Button
                      key={idx}
                      active={idx === paginationSelection}
                      onClick={() => setPaginationSelection(idx)}
                      variant="outline-primary"
                    >
                      {idx + 1}
                    </Button>
                  ))}
                </div>
              ) : hasFailedIterationResult(visibleResults) ? (
                `${visibleResults.length} elements failed query`
              ) : (
                "No element failed query"
              )}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
