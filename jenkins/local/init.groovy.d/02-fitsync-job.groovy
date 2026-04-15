import jenkins.model.Jenkins
import org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition
import org.jenkinsci.plugins.workflow.job.WorkflowJob

def instance = Jenkins.get()
def jobName = 'fitsync'
def pipelineScript = new File('/workspace/fitsync/Jenkinsfile').getText('UTF-8')

def job = instance.getItem(jobName)
if (job == null) {
  job = instance.createProject(WorkflowJob, jobName)
}

job.setDefinition(new CpsFlowDefinition(pipelineScript, true))
job.save()

instance.save()
